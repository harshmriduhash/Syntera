"""
Main entry point for the Voice Agent Service

This service:
1. Runs an HTTP API server for agent dispatch
2. Registers as a LiveKit Agent Server
3. Handles agent job dispatch and execution
"""

import os
import sys
import asyncio
import json
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import agents, api
from config import settings, validate_config
from utils.logger import setup_logger
from utils.sentry import init_sentry, capture_exception
from agent import entrypoint

# Initialize Sentry for error tracking
init_sentry()

logger = setup_logger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Syntera Voice Agent Service",
    description="Python-based LiveKit Agents service for voice AI",
    version="0.1.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class DispatchRequest(BaseModel):
    """Request model for agent dispatch"""
    conversationId: str
    agentId: str
    userId: str
    roomName: str
    token: str

class DispatchResponse(BaseModel):
    """Response model for agent dispatch"""
    success: bool
    agentJobId: str
    message: str

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "syntera-voice-agent",
        "version": "0.1.0",
        "status": "running",
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "version": "1.0.1"}


@app.post("/api/agents/dispatch", response_model=DispatchResponse)
async def dispatch_agent(request: DispatchRequest):
    """
    Dispatch an agent to a LiveKit room
    
    This endpoint is called by the Node.js agent service when a voice call starts.
    It uses LiveKit's Room Service API to add the agent as a participant, which
    triggers the agent server to dispatch the agent job.
    """
    try:
        logger.info("Dispatching agent", {
            "conversation_id": request.conversationId,
            "agent_id": request.agentId,
            "user_id": request.userId,
            "room_name": request.roomName,
        })
        
        # Initialize LiveKit API client
        lk_api = api.LiveKitAPI(
            url=settings.livekit_url,
            api_key=settings.livekit_api_key,
            api_secret=settings.livekit_api_secret,
        )
        
        identity = f"agent:{request.agentId}"
        
        logger.info("Adding agent participant to room", {
            "room_name": request.roomName,
            "identity": identity,
            "conversation_id": request.conversationId,
            "agent_id": request.agentId,
        })
        
        room_metadata = json.dumps({
            "agentId": request.agentId,
            "conversationId": request.conversationId,
            "userId": request.userId,
        })
        
        # Room may already exist, which is fine - update metadata if it does
        # Use a shorter overall timeout and make operations non-blocking where possible
        agent_job_id = f"agent-{request.agentId}-{request.conversationId}"
        
        # Start room creation/update as a background task (don't wait for it)
        # The agent server will handle room connection automatically
        async def setup_room():
            try:
                # Try to create room first with timeout
                await asyncio.wait_for(
                    lk_api.room.create_room(
                        api.CreateRoomRequest(
                            name=request.roomName,
                            empty_timeout=300,
                            max_participants=10,
                            metadata=room_metadata,
                        )
                    ),
                    timeout=5.0  # Reduced to 5 seconds
                )
                logger.info("Room created successfully", {
                    "room_name": request.roomName,
                })
            except asyncio.TimeoutError:
                logger.warning("Room creation timed out, assuming room exists", {
                    "room_name": request.roomName,
                })
                # Try to update metadata instead
                try:
                    await asyncio.wait_for(
                        lk_api.room.update_room_metadata(
                            api.UpdateRoomMetadataRequest(
                                room=request.roomName,
                                metadata=room_metadata,
                            )
                        ),
                        timeout=3.0  # Reduced timeout
                    )
                except Exception as update_error:
                    logger.warning("Could not update room metadata", {
                        "room_name": request.roomName,
                        "error": str(update_error),
                    })
            except Exception as e:
                logger.info("Room already exists or error creating room, updating metadata", {
                    "room_name": request.roomName,
                    "error": str(e),
                })
                try:
                    await asyncio.wait_for(
                        lk_api.room.update_room_metadata(
                            api.UpdateRoomMetadataRequest(
                                room=request.roomName,
                                metadata=room_metadata,
                            )
                        ),
                        timeout=3.0  # Reduced timeout
                    )
                except Exception as update_error:
                    logger.warning("Could not update room metadata", {
                        "room_name": request.roomName,
                        "error": str(update_error),
                    })
        
        # Start room setup as background task (don't wait for completion)
        # This allows the endpoint to return quickly
        asyncio.create_task(setup_room())
        
        # Return immediately - the agent server will connect to the room automatically
        # when it detects a participant joins
        return DispatchResponse(
            success=True,
            agentJobId=agent_job_id,
            message="Agent dispatch request processed. Agent server will connect to room."
        )
        
    except Exception as e:
        logger.error("Failed to dispatch agent", {
            "conversation_id": request.conversationId,
            "agent_id": request.agentId,
            "error": str(e),
        })
        # Capture to Sentry with context
        from utils.sentry import set_sentry_context
        set_sentry_context(
            tags={
                'agentId': request.agentId,
                'conversationId': request.conversationId,
                'userId': request.userId,
                'roomName': request.roomName,
            },
            extra={
                'errorType': 'dispatch_error',
            }
        )
        capture_exception(e)
        raise HTTPException(status_code=500, detail=str(e))

def run_agent_server():
    """Run the LiveKit Agent Server"""
    logger.info("Starting LiveKit Agent Server", {
        "livekit_url": settings.livekit_url,
    })
    
    # Validate OpenAI configuration before starting
    from config import validate_openai_config
    if not validate_openai_config():
        logger.warning("OpenAI API key not configured. Agent voice responses will not work.")
        logger.warning("Please set OPENAI_API_KEY in your .env file.")
    else:
        logger.info("OpenAI API key configured. Voice responses enabled.")
    
    import subprocess
    script_path = Path(__file__).parent / "agent_server.py"
    
    # Run the agent server script
    logger.info("Registering agent server with LiveKit...")
    try:
        subprocess.run(
            [sys.executable, str(script_path), "dev"],
            check=True,
            cwd=str(Path(__file__).parent.parent),
        )
    except KeyboardInterrupt:
        logger.info("Agent server stopped")
    except Exception as e:
        logger.error("Agent server error", {"error": str(e)})
        capture_exception(e)
        raise

def run_api_server():
    """Run the HTTP API server"""
    import uvicorn
    
    logger.info("Starting HTTP API server", {
        "port": settings.api_server_port,
    })
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=settings.api_server_port,
        log_level=settings.log_level.lower(),
    )

if __name__ == "__main__":
    import argparse
    import threading
    
    parser = argparse.ArgumentParser(description="Syntera Voice Agent Service")
    parser.add_argument(
        "--mode",
        choices=["api", "agent", "both"],
        default="both",
        help="Run mode: 'api' (API server only), 'agent' (agent server only), or 'both' (default)"
    )
    args = parser.parse_args()
    
    # Validate configuration
    if not validate_config():
        logger.warning("Some configuration is missing. Service may not work correctly.")
        logger.warning("Please check your .env file and ensure all required variables are set.")
        if args.mode == "agent":
            logger.error("Cannot run agent server without proper configuration.")
            sys.exit(1)
        logger.warning("Continuing anyway for testing purposes...")
    
    if args.mode == "api":
        # Run only API server
        logger.info("Starting API server only...")
        run_api_server()
    elif args.mode == "agent":
        # Run only agent server
        logger.info("Starting agent server only...")
        run_agent_server()
    else:
        # Run both servers - API server in main thread, agent server as subprocess
        logger.info("Starting both API server and agent server...")
        
        import subprocess
        import threading
        import time
        script_path = Path(__file__).parent / "agent_server.py"
        
        def forward_output(pipe, prefix):
            for line in iter(pipe.readline, ''):
                if line:
                    logger.info(f"[AGENT-SERVER] {line.rstrip()}")
            pipe.close()
        
        agent_process = subprocess.Popen(
            [sys.executable, str(script_path), "dev"],
            cwd=str(Path(__file__).parent.parent),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        
        stdout_thread = threading.Thread(
            target=forward_output,
            args=(agent_process.stdout, "[AGENT-SERVER]"),
            daemon=True
        )
        stdout_thread.start()
        
        time.sleep(3)
        
        if agent_process.poll() is not None:
            logger.error("Agent server process died immediately", {
                "returncode": agent_process.returncode,
            })
        
        try:
            run_api_server()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            sys.exit(0)


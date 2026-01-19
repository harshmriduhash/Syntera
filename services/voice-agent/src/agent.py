"""LiveKit Agent implementation following best practices"""

import sys
import json
import datetime
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from livekit.agents import Agent, AgentServer, AgentSession, JobContext, room_io, cli, ChatContext, ChatMessage
from livekit import rtc
import asyncio
from livekit.plugins import silero
from livekit.plugins.noise_cancellation import BVCTelephony, BVC
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from supabase_client import get_agent_config, get_supabase_client
from config import settings, validate_openai_config
from utils.logger import setup_logger
from utils.sentry import init_sentry, set_sentry_context, capture_exception
from knowledge_base import get_knowledge_base_context, enhance_system_prompt_with_kb
from message_saver import save_message, update_conversation_status
from contact_extractor import extract_contact_info_llm, merge_contact_info
from typing import Optional
import aiohttp

# Initialize Sentry for error tracking
init_sentry()

logger = setup_logger(__name__)

# Create agent server instance
server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    """
    Agent entrypoint - called when agent is dispatched to a LiveKit room
    
    Following LiveKit best practices:
    - Uses @server.rtc_session() decorator
    - AgentSession handles connection automatically
    - Simple, clean structure
    """
    # Set log context fields for better observability
    ctx.log_context_fields = {
        "room_name": ctx.room.name,
    }
    
    
    # Extract metadata from job
    agent_id = None
    conversation_id = None
    user_id = None
    
    # Try job metadata first
    metadata = ctx.job.metadata or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except Exception:
            metadata = {}
    
    
    if isinstance(metadata, dict):
        agent_id = metadata.get("agentId") or metadata.get("agent_id")
        conversation_id = metadata.get("conversationId") or metadata.get("conversation_id")
        user_id = metadata.get("userId") or metadata.get("user_id")
    
    # Fallback to room metadata if job metadata not available
    if not agent_id:
        try:
            room_metadata_raw = None
            
            if hasattr(ctx.room, 'metadata'):
                room_metadata_raw = ctx.room.metadata
            
            if not room_metadata_raw and hasattr(ctx.room, 'info'):
                room_info = ctx.room.info
                if room_info and hasattr(room_info, 'metadata'):
                    room_metadata_raw = room_info.metadata
            
            if not room_metadata_raw:
                try:
                    from livekit import api
                    lk_api = api.LiveKitAPI(
                        url=settings.livekit_url,
                        api_key=settings.livekit_api_key,
                        api_secret=settings.livekit_api_secret,
                    )
                    rooms_response = await lk_api.room.list_rooms(api.ListRoomsRequest(names=[ctx.room.name]))
                    if rooms_response and rooms_response.rooms:
                        for room in rooms_response.rooms:
                            if room.name == ctx.room.name and room.metadata:
                                room_metadata_raw = room.metadata
                                break
                except Exception as api_error:
                    logger.warning(f"Could not fetch room metadata from API: {api_error}", exc_info=True)
            
            if room_metadata_raw:
                if isinstance(room_metadata_raw, str):
                    room_metadata = json.loads(room_metadata_raw)
                else:
                    room_metadata = room_metadata_raw
                
                if isinstance(room_metadata, dict):
                    agent_id = room_metadata.get("agentId") or room_metadata.get("agent_id") or agent_id
                    conversation_id = room_metadata.get("conversationId") or room_metadata.get("conversation_id") or conversation_id
                    user_id = room_metadata.get("userId") or room_metadata.get("user_id") or user_id
        except Exception as e:
            logger.warning(f"Failed to parse room metadata: {e}", exc_info=True)
    
    # Extract conversation_id from room name if available
    if not conversation_id and ctx.room.name.startswith("conversation:"):
        conversation_id = ctx.room.name.replace("conversation:", "")
    
    # Extract company_id from metadata if available
    company_id = None
    if isinstance(metadata, dict):
        company_id = metadata.get("companyId") or metadata.get("company_id")
    
    # Use default config if agent_id not found
    if not agent_id:
        agent_id = "unknown"
        logger.warning("Using default agent config (agentId not found)")
    
    # Load agent configuration
    if agent_id == "unknown":
        config = {
            "agent_id": "unknown",
            "company_id": None,
            "name": "Test Agent",
            "model": "gpt-4o-mini",
            "system_prompt": (
                "You are a helpful AI assistant. "
                "IMPORTANT: You should continue the conversation indefinitely. "
                "Even if the user says 'I'm done', 'goodbye', 'end call', or similar phrases, "
                "you should acknowledge them politely but continue to be available. "
                "The call will only end when the user manually disconnects. "
                "Never attempt to end the conversation yourself - always remain available and helpful."
            ),
            "temperature": 0.7,
        }
    else:
        # CRITICAL: Pass company_id for data isolation
        # If company_id is not in metadata, we'll fetch it from the agent config
        # but this is less secure - prefer passing it in metadata
        config = await get_agent_config(agent_id, company_id)
        
        # If company_id wasn't in metadata, get it from config
        if not company_id:
            company_id = config.get("company_id")
            if company_id:
                logger.info("Extracted company_id from agent config", {
                    "agent_id": agent_id,
                    "company_id": company_id,
                })
            else:
                logger.warning("Company ID not found in agent config or metadata", {
                    "agent_id": agent_id,
                })
    
    
    # Get company_id for KB queries (use from config if not already set)
    if not company_id:
        company_id = config.get("company_id")
    kb_enabled = company_id and agent_id != "unknown"
    
    # Retrieve initial knowledge base context if available
    initial_kb_context = None
    if kb_enabled:
        try:
            # Use a generic query for initial context
            initial_kb_context = await get_knowledge_base_context(
                query="company information and products",
                company_id=company_id,
                agent_id=agent_id,
                top_k=5
            )
        except Exception as e:
            logger.warn(f"Failed to retrieve initial knowledge base context: {e}", exc_info=True)
    
    # Enhance system prompt with agent identity and initial KB context
    system_prompt = config.get("system_prompt", "You are a helpful AI assistant.")
    
    # Inject agent name and description into system prompt
    agent_name = config.get("name", "AI Assistant")
    agent_description = config.get("description", "")
    
    if agent_name or agent_description:
        identity_info = f"\n\nYou are {agent_name}"
        if agent_description:
            identity_info += f", a {agent_description.lower()}"
        identity_info += "."
        
        # Insert identity info after the first sentence or at the beginning
        if system_prompt.strip():
            # Add identity at the beginning for clarity
            system_prompt = identity_info + "\n\n" + system_prompt
        else:
            system_prompt = identity_info
    
    # Enhance with initial KB context
    if initial_kb_context:
        system_prompt = enhance_system_prompt_with_kb(system_prompt, initial_kb_context)
    
    # Add multilingual support instructions
    multilingual_instruction = """
    
MULTILINGUAL SUPPORT:
- You can understand and respond in multiple languages (English, French, Spanish, German, Italian, Portuguese, etc.)
- Always respond in the SAME language the user is speaking
- If the user speaks French, respond in French. If they speak Spanish, respond in Spanish
- Match the user's language automatically - do not ask what language they prefer
- If you're unsure about the language, respond in the language that seems most natural based on the user's input
- Maintain the same language throughout the conversation unless the user explicitly switches languages"""
    
    system_prompt += multilingual_instruction
    
    # Check if this is a new conversation (no previous messages)
    is_new_conversation = True
    if conversation_id:
        try:
            chat_url = f"{settings.chat_service_url}/api/internal/messages/list"
            headers = {
                "Authorization": f"Bearer {settings.internal_service_token}",
                "Content-Type": "application/json",
            }
            params = {
                "conversationId": conversation_id,
                "limit": 1
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(chat_url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=5)) as response:
                    if response.status == 200:
                        data = await response.json()
                        messages = data.get("messages", [])
                        is_new_conversation = len(messages) == 0
        except Exception as e:
            logger.debug(f"Could not check conversation history: {e}")
            # Default to new conversation if check fails
    
    # Add conversation continuity instructions
    if is_new_conversation:
        # Get agent description for greeting
        agent_description = config.get("description", "")
        greeting_info = f"I'm {agent_name}"
        if agent_description:
            # Extract key capabilities from description (first sentence or key phrases)
            greeting_info += f", {agent_description.split('.')[0].lower()}"
        
        conversation_continuity_instruction = f"""
    
IMPORTANT - INITIAL GREETING:
- This is a NEW conversation with no previous messages
- You MUST speak first and introduce yourself
- Start with a friendly greeting that includes:
  1. Your name: "Hello! I'm {agent_name}"
  2. What you can help with (based on your role): Briefly mention your main capabilities (e.g., "I can help you with product questions, order tracking, and returns" or similar based on your description)
- Keep the greeting concise (2-3 sentences max)
- Wait for the user to respond after your greeting
- Be friendly, professional, and welcoming
- Do NOT use generic phrases like "How can I help you today?" - let the LLM generate natural, context-appropriate greetings"""
    else:
        conversation_continuity_instruction = """
    
IMPORTANT - CONVERSATION CONTINUITY:
- There is already conversation history (previous messages in the chat)
- DO NOT greet again or introduce yourself again
- Continue the conversation naturally from where it left off
- If the user asks a question, answer it directly without re-greeting
- Maintain context from previous turns - reference what was discussed earlier if relevant
- Do NOT reset the conversation or act like it's a new conversation"""
    
    # Add contact information collection instructions (same as text chat agent)
    contact_collection_instruction = """
    
CONTACT INFORMATION COLLECTION - SMART TIMING:
Your PRIMARY goal is to answer the user's question completely and helpfully. AFTER providing a good answer, naturally ask for contact information when it makes sense.

WHEN TO ASK (prioritize answering first, then ask):
1. After fully answering a product/service question - Then offer: "I'd be happy to send you more detailed information. What's your email?"
2. After providing pricing information - Then offer: "I can send you a complete price list. What's your email address?"
3. When user shows clear interest (asks about specific products, wants to buy) - After helping, ask for follow-up
4. After 2-3 meaningful exchanges where you've provided value - Natural moment to ask

TIMING GUIDELINES:
- ALWAYS answer the question FIRST, completely and helpfully
- THEN, if appropriate, naturally transition to asking for contact info
- Spot the best moment - when the user seems engaged and you've provided value
- Don't ask too early (before establishing value) or too late (after they've lost interest)
- If the user's question requires immediate focus, answer fully first, then ask

GOOD EXAMPLES:
- User: "what are your products?" → You: [complete answer about products] → "I'd be happy to send you our full catalog. What's your email?"
- User: "what are the prices?" → You: [complete pricing information] → "I can send you a detailed price list with all options. What's your email?"
- User: "I'm interested in jeans" → You: [help with jeans] → "Great! I can send you more details about our jeans collection. What's your email?"

BAD EXAMPLES (don't do this):
- Asking before answering: "What's your email? [then provides info]" ❌
- Asking when user just said "no" or seems uninterested ❌
- Asking in the very first greeting ❌

When user provides contact information, acknowledge it warmly and CONTINUE the conversation naturally. Do NOT reset to greeting."""
    
    system_prompt += conversation_continuity_instruction
    system_prompt += contact_collection_instruction
    
    # Add spoken-style text generation instructions for more natural voice
    spoken_style_instruction = """
    
SPOKEN-STYLE TEXT GENERATION (CRITICAL FOR NATURAL VOICE):
You are speaking to the user in a voice conversation, NOT writing text. Generate responses that sound natural when spoken aloud.

KEY PRINCIPLES:
- Use SHORTER sentences (10-15 words max) - long sentences sound robotic when read
- Add NATURAL PAUSES by using commas, periods, and ellipses strategically
- Use CONVERSATIONAL language - say "I can help with that" instead of "I am able to assist you with that matter"
- Vary your sentence structure - mix short and medium sentences
- Use CONTRACTIONS naturally: "I'm", "you're", "we've", "that's" - this sounds more human
- Avoid complex nested clauses - break them into separate sentences
- Use EMPHASIS words naturally: "really", "actually", "definitely", "absolutely" - but sparingly
- End sentences with natural intonation - questions should sound like questions

EXAMPLES:
❌ BAD (written style): "I would be happy to provide you with detailed information regarding our comprehensive product catalog, which includes a wide variety of items that may be of interest to you."
✅ GOOD (spoken style): "I'd be happy to help! We have a great product catalog. What are you looking for?"

❌ BAD: "In order to assist you more effectively, I would need to gather some additional information from you."
✅ GOOD: "I can help with that. Let me ask you a quick question first."

❌ BAD: "The product you are inquiring about is currently available in our inventory."
✅ GOOD: "Yes, that product's in stock! We have it available right now."

TONE:
- Sound like a helpful, friendly person having a conversation
- Be warm but professional
- Use natural speech patterns, not formal written language
- Imagine you're talking to someone face-to-face, not writing an email"""
    
    system_prompt += spoken_style_instruction
    
    # Get voice settings from config
    voice_settings = config.get("voice_settings") or {}
    # Default to ElevenLabs if available, fallback to Cartesia
    tts_voice = voice_settings.get("tts_voice")
    if not tts_voice:
        # Use ElevenLabs if API key is configured, otherwise fallback to Cartesia
        if settings.elevenlabs_api_key:
            # Default ElevenLabs Turbo v2.5 voice (Rachel - Natural, Professional Female)
            # Format: elevenlabs/eleven_turbo_v2_5:{voice_id} - uses most natural model with emotion support
            # This format ensures we use the turbo v2.5 model which has better prosody and emotion handling
            tts_voice = "elevenlabs/eleven_turbo_v2_5:21m00Tcm4TlvDq8ikWAM"  # Rachel - natural, professional female voice
            logger.info("Using ElevenLabs Turbo v2.5 TTS for more natural voice quality with emotion support")
        else:
            # Fallback to Cartesia if ElevenLabs not configured
            tts_voice = "cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
            logger.warning("ElevenLabs API key not configured. Using Cartesia TTS. Set ELEVENLABS_API_KEY for better voice quality.")
    
    # Create STT-LLM-TTS pipeline session
    # Load VAD model (required for turn detection)
    vad = silero.VAD.load()
    
    # Try to initialize turn detection, but make it optional
    # The MultilingualModel requires model files that may not be available in production
    turn_detection = None
    try:
        turn_detection = MultilingualModel()
        logger.info("Turn detection initialized successfully")
    except (RuntimeError, FileNotFoundError, Exception) as td_error:
        # Catch all exceptions including RuntimeError from missing model files
        logger.warning(f"Failed to initialize turn detection (continuing without it): {td_error}")
        logger.info("Agent will use VAD-only for turn detection")
        turn_detection = None  # Explicitly set to None
    
    # Create agent session with STT-LLM-TTS pipeline
    # This should not fail even if turn_detection is None
    try:
        session = AgentSession(
            stt="assemblyai/universal-streaming",  # Multilingual Speech-to-Text (auto-detects language)
            llm="openai/gpt-4.1-mini",  # LLM via LiveKit Inference (supports multiple languages)
            tts=tts_voice,  # Text-to-Speech (ElevenLabs or Cartesia - supports multiple languages)
            vad=vad,  # Voice Activity Detection
            turn_detection=turn_detection,  # Turn detection (optional - falls back to VAD if None)
        )
    except Exception as e:
        logger.error(f"Failed to create STT-LLM-TTS session: {e}", exc_info=True)
        raise ValueError(f"Failed to initialize STT-LLM-TTS pipeline: {e}")
    
    # Create a custom Agent class with dynamic KB integration
    class DynamicKBAgent(Agent):
        """Agent with dynamic knowledge base queries per user turn"""
        
        def __init__(self, instructions: str, kb_enabled: bool, company_id: Optional[str], agent_id: str, agent_name: str = "AI Assistant", is_new_conversation: bool = False):
            super().__init__(instructions=instructions)
            self.kb_enabled = kb_enabled
            self.company_id = company_id
            self.agent_id = agent_id
            self.agent_name = agent_name
            self.is_new_conversation = is_new_conversation
        
        async def on_session_started(self, ctx: ChatContext) -> None:
            """Called when the session starts - send initial greeting if new conversation"""
            # Note: This callback may not be the right place for session.say()
            # We'll handle greeting after session.start() completes instead
            pass
        
        async def on_user_turn_completed(
            self, turn_ctx: ChatContext, new_message: ChatMessage
        ) -> None:
            """Called when user's turn is completed, before agent's reply"""
            if not self.kb_enabled or not self.company_id:
                return
            
            try:
                # Get user's message text
                if hasattr(new_message, 'text_content'):
                    user_text = new_message.text_content
                elif hasattr(new_message, 'content'):
                    user_text = str(new_message.content)
                else:
                    user_text = ''
                
                if not user_text:
                    return
                
                # Query KB with the actual user question
                kb_context = await get_knowledge_base_context(
                    query=user_text,
                    company_id=self.company_id,
                    agent_id=self.agent_id,
                    top_k=5
                )
                
                if kb_context:
                    turn_ctx.add_message(
                        role="assistant",
                        content=f"Relevant information from knowledge base:\n{kb_context}"
                    )
                    
            except Exception as e:
                logger.error(f"Error querying KB in on_user_turn_completed: {e}", exc_info=True)
    
    # Create agent instance with dynamic KB support
    agent = DynamicKBAgent(
        instructions=system_prompt,
        kb_enabled=kb_enabled,
        company_id=company_id,
        agent_id=agent_id,
        agent_name=agent_name,
        is_new_conversation=is_new_conversation
    )
    
    def on_session_close(event):
        error = getattr(event, 'error', None)
        if error:
            logger.error(f"Session closed with error: {error}", exc_info=error if hasattr(error, '__traceback__') else None)
        
        # Update conversation status to 'ended' when session closes
        if conversation_id:
            import datetime
            ended_at = datetime.datetime.utcnow().isoformat() + 'Z'
            asyncio.create_task(update_conversation_status(
                conversation_id=conversation_id,
                status='ended',
                ended_at=ended_at
            ))
    
    def on_agent_state_changed(event):
        old_state = getattr(event, 'old_state', 'unknown')
        new_state = getattr(event, 'new_state', 'unknown')
        logger.info(f"Agent state: {old_state} -> {new_state}")
    
    async def process_contact_info_from_message(message_content: str):
        """Process contact information from user message (async)"""
        if not conversation_id or not company_id:
            return
        
        try:
            # Get conversation context from chat service for better extraction
            conversation_context = []
            try:
                chat_url = f"{settings.chat_service_url}/api/internal/messages/list"
                headers = {
                    "Authorization": f"Bearer {settings.internal_service_token}",
                    "Content-Type": "application/json",
                }
                params = {
                    "conversationId": conversation_id,
                    "limit": 10
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.get(chat_url, headers=headers, params=params, timeout=aiohttp.ClientTimeout(total=5)) as response:
                        if response.status == 200:
                            data = await response.json()
                            messages = data.get("messages", [])
                            # Reverse to get chronological order
                            messages.reverse()
                            conversation_context = [
                                {
                                    "role": "assistant" if msg.get("role") == "agent" else msg.get("role", "user"),
                                    "content": msg.get("content", "")
                                }
                                for msg in messages[-5:]  # Last 5 messages
                            ]
            except Exception as e:
                logger.debug(f"Could not fetch conversation context: {e}")
            
            # Extract contact info using LLM
            extracted = await extract_contact_info_llm(message_content, conversation_context if conversation_context else None)
            
            # Skip if nothing extracted
            if not extracted.has_contact_info():
                return
            
            if extracted.errors_detected:
                logger.info("Contact info errors detected and corrected", {
                    "errors": extracted.errors_detected,
                    "corrections": extracted.corrections_made,
                })
            
            # Get current conversation metadata and merge
            try:
                conv_url = f"{settings.chat_service_url}/api/internal/conversations/{conversation_id}"
                headers = {
                    "Authorization": f"Bearer {settings.internal_service_token}",
                    "Content-Type": "application/json",
                }
                
                async with aiohttp.ClientSession() as session:
                    # Get current conversation
                    async with session.get(conv_url, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as response:
                        if response.status == 200:
                            conv_data = await response.json()
                            conversation = conv_data.get("conversation", {})
                            current_metadata = conversation.get("metadata", {}) or {}
                            
                            # Merge extracted info with existing metadata
                            updated_metadata = merge_contact_info(current_metadata, extracted)
                            
                            # Update conversation metadata
                            update_payload = {"metadata": updated_metadata}
                            async with session.patch(conv_url, json=update_payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as update_response:
                                if update_response.status == 200:
                                    # If we have email or phone, create/update contact via Supabase
                                    email = updated_metadata.get("email") or extracted.email
                                    phone = updated_metadata.get("phone") or extracted.phone
                                    
                                    if email or phone:
                                        supabase = get_supabase_client()
                                        
                                        # Try to find existing contact by email or phone
                                        existing_contact = None
                                        if email:
                                            result = supabase.table("contacts").select("id").eq("company_id", company_id).eq("email", email).maybe_single().execute()
                                            if result and result.data:
                                                existing_contact = result.data
                                        
                                        if not existing_contact and phone:
                                            result = supabase.table("contacts").select("id").eq("company_id", company_id).eq("phone", phone).maybe_single().execute()
                                            if result and result.data:
                                                existing_contact = result.data
                                        
                                        if existing_contact:
                                            # Update existing contact
                                            contact_id = existing_contact["id"]
                                            update_data = {}
                                            
                                            # Update basic fields if missing or if new data is available
                                            if extracted.first_name and not updated_metadata.get("first_name"):
                                                update_data["first_name"] = extracted.first_name
                                            elif updated_metadata.get("first_name"):
                                                update_data["first_name"] = updated_metadata.get("first_name")
                                            
                                            if extracted.last_name and not updated_metadata.get("last_name"):
                                                update_data["last_name"] = extracted.last_name
                                            elif updated_metadata.get("last_name"):
                                                update_data["last_name"] = updated_metadata.get("last_name")
                                            
                                            if extracted.company_name and not updated_metadata.get("company_name"):
                                                update_data["company_name"] = extracted.company_name
                                            elif updated_metadata.get("company_name"):
                                                update_data["company_name"] = updated_metadata.get("company_name")
                                            
                                            # Update email/phone if missing
                                            if email and not existing_contact.get("email"):
                                                update_data["email"] = email
                                            if phone and not existing_contact.get("phone"):
                                                update_data["phone"] = phone
                                            
                                            # Merge metadata field (preserve existing, add new)
                                            if updated_metadata:
                                                # Fetch current contact to get existing metadata
                                                current_contact_result = supabase.table("contacts").select("metadata").eq("id", contact_id).eq("company_id", company_id).maybe_single().execute()
                                                existing_metadata = {}
                                                if current_contact_result and current_contact_result.data and current_contact_result.data.get("metadata"):
                                                    existing_metadata = current_contact_result.data["metadata"] or {}
                                                
                                                # Merge: existing metadata + new metadata (new overwrites old)
                                                merged_metadata = {**existing_metadata, **updated_metadata}
                                                update_data["metadata"] = merged_metadata
                                            
                                            if update_data:
                                                update_data["updated_at"] = datetime.datetime.utcnow().isoformat() + "Z"
                                                supabase.table("contacts").update(update_data).eq("id", contact_id).eq("company_id", company_id).execute()
                                        else:
                                            # Create new contact
                                            contact_data = {
                                                "company_id": company_id,
                                                "email": email or None,
                                                "phone": phone or None,
                                                "first_name": updated_metadata.get("first_name") or extracted.first_name or None,
                                                "last_name": updated_metadata.get("last_name") or extracted.last_name or None,
                                                "company_name": updated_metadata.get("company_name") or extracted.company_name or None,
                                                "metadata": {
                                                    "source": "voice_call",
                                                    "auto_created": True,
                                                    "extracted_from_message": True,
                                                    **updated_metadata,
                                                }
                                            }
                                            
                                            result = supabase.table("contacts").insert(contact_data).execute()
                                            if result.data and len(result.data) > 0:
                                                contact_id = result.data[0]["id"]
                                                
                                                # Link conversation to contact
                                                link_payload = {"contact_id": contact_id}
                                                async with session.patch(conv_url, json=link_payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as link_response:
                                                    if link_response.status == 200:
                                                        pass
                                else:
                                    logger.warn("Failed to update conversation metadata", {
                                        "status": update_response.status,
                                        "conversation_id": conversation_id,
                                    })
            except Exception as e:
                logger.error(f"Error processing contact info: {e}", exc_info=True)
                
        except Exception as e:
            logger.error(f"Error in process_contact_info_from_message: {e}", exc_info=True)
    
    def on_conversation_item_added(event):
        """Handle conversation items (both user and agent messages)"""
        try:
            item = getattr(event, 'item', None)
            if not item or not conversation_id:
                return
            
            # Determine if it's user or agent message
            role = getattr(item, 'role', '')
            content = getattr(item, 'text', '') or getattr(item, 'content', '')
            
            if not content:
                return
            
            # Clean content - remove JSON array formatting if present
            content_str = str(content).strip()
            # Remove JSON array brackets and quotes: ['text'] -> text
            if content_str.startswith('[') and content_str.endswith(']'):
                try:
                    import json
                    parsed = json.loads(content_str)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        content_str = str(parsed[0])
                    elif isinstance(parsed, str):
                        content_str = parsed
                except:
                    # If JSON parsing fails, just remove brackets
                    content_str = content_str.strip('[]').strip('"').strip("'")
            
            # Skip empty content after cleaning
            if not content_str:
                return
            
            # Map role to sender_type
            sender_type = 'user' if role == 'user' else 'agent'
            
            # Save message
            asyncio.create_task(save_message(
                conversation_id=conversation_id,
                content=content_str,
                sender_type=sender_type,
                message_type='audio',
                metadata={'source': 'voice_call', 'transcript_type': 'audio'}
            ))
            
            # Process contact information from user messages (async, don't block)
            if sender_type == 'user':
                asyncio.create_task(process_contact_info_from_message(content_str))
                
        except Exception as e:
            logger.error(f"Error handling conversation item: {e}", exc_info=True)
    
    session.on("close", on_session_close)
    session.on("agent_state_changed", on_agent_state_changed)
    
    try:
        session.on("conversation_item_added", on_conversation_item_added)
    except Exception as e:
        logger.warning(f"Could not register transcript event listeners: {e}. Transcripts may not be saved.", exc_info=True)
    
    # Configure room options with telephony-optimized noise cancellation
    room_options = room_io.RoomOptions(
        close_on_disconnect=False,
        audio_input=room_io.AudioInputOptions(
            noise_cancellation=lambda params: (
                BVCTelephony() 
                if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP 
                else BVC()
            ),
        ),
    )
    
    shutdown_future: asyncio.Future[None] = asyncio.Future()
    room_disconnect_future: asyncio.Future[None] = asyncio.Future()
    
    async def _on_shutdown(_reason: str) -> None:
        if not shutdown_future.done():
            shutdown_future.set_result(None)
    
    def _on_room_disconnected(_: rtc.Room) -> None:
        if not room_disconnect_future.done():
            room_disconnect_future.set_result(None)
    
    async def send_initial_greeting_after_start():
        """Send initial greeting after session starts"""
        if is_new_conversation:
            try:
                # Wait a moment for session to be fully ready
                await asyncio.sleep(0.5)
                
                # Generate greeting using LLM via generate_reply
                # This ensures the greeting is LLM-powered, not hardcoded
                # Use spoken-style: short sentences, natural pauses, conversational tone
                greeting_instructions = f"Introduce yourself as {agent_name}. {('Briefly mention: ' + agent_description.split('.')[0] + '.') if agent_description else ''} Use SHORT sentences (10-15 words max), natural pauses, and a conversational tone. Keep it friendly and concise (2-3 sentences max). Do NOT use generic phrases like 'How can I help you today?' - generate a natural, context-appropriate greeting that sounds like you're speaking, not reading."
                
                await session.generate_reply(
                    instructions=greeting_instructions,
                    allow_interruptions=False
                )
                logger.info("Sent initial LLM-powered greeting", {
                    "agent_name": agent_name,
                    "agent_id": agent_id
                })
            except Exception as e:
                logger.warning(f"Failed to send initial greeting: {e}", exc_info=True)
    
    ctx.add_shutdown_callback(_on_shutdown)
    ctx.room.on("disconnected", _on_room_disconnected)
    
    try:
        session_task = asyncio.create_task(
            session.start(
                room=ctx.room,
                agent=agent,
                room_options=room_options,
            )
        )
        
        # Send initial greeting after session starts (non-blocking)
        asyncio.create_task(send_initial_greeting_after_start())
        
        # Wait for session start, shutdown signal, or room disconnect
        done, pending = await asyncio.wait(
            [session_task, shutdown_future, room_disconnect_future],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        if session_task in done:
            try:
                await session_task
            except Exception as e:
                logger.warning(f"Session task error: {e}", exc_info=True)
            
            await asyncio.wait(
                [shutdown_future, room_disconnect_future],
                return_when=asyncio.FIRST_COMPLETED
            )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
            
    except Exception as e:
        logger.error(f"Session error: {e}", exc_info=True)
        # Capture to Sentry with context
        set_sentry_context(
            tags={
                'agentId': str(agent_id) if agent_id else 'unknown',
                'conversationId': str(conversation_id) if conversation_id else 'unknown',
                'roomName': ctx.room.name,
            },
            extra={
                'errorType': 'session_error',
            }
        )
        capture_exception(e)
        raise
    finally:
        ctx.room.off("disconnected", _on_room_disconnected)
        
        if hasattr(session, 'aclose'):
            try:
                await session.aclose()
            except Exception as e:
                logger.warning(f"Error closing session: {e}", exc_info=True)


if __name__ == "__main__":
    cli.run_app(server)

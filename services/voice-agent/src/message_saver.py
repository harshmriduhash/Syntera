"""Message saver for voice agent transcripts
Saves voice call transcripts to MongoDB via chat service API
"""

import aiohttp
import asyncio
from typing import Optional, Dict, Any
from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)


async def save_message(
    conversation_id: str,
    content: str,
    sender_type: str,  # 'user' or 'agent'
    message_type: str = 'audio',
    thread_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Save a message to MongoDB via chat service internal API
    
    Args:
        conversation_id: The conversation ID
        content: Message content (transcript text)
        sender_type: 'user' or 'agent'
        message_type: Message type (default: 'audio')
        thread_id: Optional thread ID
        metadata: Optional metadata dict
        
    Returns:
        True if saved successfully, False otherwise
    """
    if not content or not content.strip():
        logger.debug("Skipping empty message")
        return False
    
    url = f"{settings.chat_service_url}/api/internal/messages/create"
    headers = {
        "Authorization": f"Bearer {settings.internal_service_token}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "conversationId": conversation_id,
        "content": content.strip(),
        "senderType": sender_type,
        "messageType": message_type,
        "threadId": thread_id,
        "metadata": metadata or {},
    }
    
    # Validate configuration before making request
    if not settings.chat_service_url:
        logger.error("CHAT_SERVICE_URL not configured", {
            "conversation_id": conversation_id,
        })
        return False
    
    if not settings.internal_service_token:
        logger.error("INTERNAL_SERVICE_TOKEN not configured", {
            "conversation_id": conversation_id,
        })
        return False
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.debug("Message saved successfully", {
                        "conversation_id": conversation_id,
                        "sender_type": sender_type,
                    })
                    return True
                else:
                    error_text = await response.text()
                    logger.error("Failed to save message", {
                        "status": response.status,
                        "status_text": response.reason,
                        "error": error_text[:500],  # Limit error text length
                        "conversation_id": conversation_id,
                        "url": url,
                    })
                    return False
    except asyncio.TimeoutError:
        logger.error("Timeout saving message", {
            "conversation_id": conversation_id,
            "url": url,
        })
        return False
    except aiohttp.ClientError as e:
        logger.error("HTTP client error saving message", {
            "error": str(e),
            "error_type": type(e).__name__,
            "conversation_id": conversation_id,
            "url": url,
        })
        return False
    except Exception as e:
        logger.error("Error saving message", {
            "error": str(e),
            "error_type": type(e).__name__,
            "conversation_id": conversation_id,
            "url": url,
            "exc_info": True,
        })
        return False


async def update_conversation_status(
    conversation_id: str,
    status: str = 'ended',
    ended_at: Optional[str] = None
) -> bool:
    """
    Update conversation status via chat service internal API
    
    Args:
        conversation_id: The conversation ID
        status: New status (default: 'ended')
        ended_at: Optional ended_at timestamp (ISO format)
        
    Returns:
        True if updated successfully, False otherwise
    """
    url = f"{settings.chat_service_url}/api/internal/conversations/{conversation_id}"
    headers = {
        "Authorization": f"Bearer {settings.internal_service_token}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "status": status,
    }
    if ended_at:
        payload["ended_at"] = ended_at
    
    # Validate configuration before making request
    if not settings.chat_service_url:
        logger.error("CHAT_SERVICE_URL not configured", {
            "conversation_id": conversation_id,
        })
        return False
    
    if not settings.internal_service_token:
        logger.error("INTERNAL_SERVICE_TOKEN not configured", {
            "conversation_id": conversation_id,
        })
        return False
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.patch(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    logger.debug("Conversation status updated successfully", {
                        "conversation_id": conversation_id,
                        "status": status,
                    })
                    return True
                else:
                    error_text = await response.text()
                    logger.error("Failed to update conversation status", {
                        "status": response.status,
                        "status_text": response.reason,
                        "error": error_text[:500],  # Limit error text length
                        "conversation_id": conversation_id,
                        "url": url,
                    })
                    return False
    except asyncio.TimeoutError:
        logger.error("Timeout updating conversation status", {
            "conversation_id": conversation_id,
            "url": url,
        })
        return False
    except aiohttp.ClientError as e:
        logger.error("HTTP client error updating conversation status", {
            "error": str(e),
            "error_type": type(e).__name__,
            "conversation_id": conversation_id,
            "url": url,
        })
        return False
    except Exception as e:
        logger.error("Error updating conversation status", {
            "error": str(e),
            "error_type": type(e).__name__,
            "conversation_id": conversation_id,
            "url": url,
            "exc_info": True,
        })
        return False


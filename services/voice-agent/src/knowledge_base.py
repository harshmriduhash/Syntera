"""Knowledge Base integration for voice agent"""

import asyncio
import aiohttp
from typing import Optional
from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)


async def get_knowledge_base_context(
    query: str,
    company_id: str,
    agent_id: str,
    top_k: int = 5
) -> Optional[str]:
    """
    Retrieve knowledge base context for a query
    
    Args:
        query: The search query (user message or conversation context)
        company_id: Company ID for filtering documents
        agent_id: Agent ID for filtering documents
        top_k: Number of results to return
        
    Returns:
        Combined knowledge base context as string, or None if no results
    """
    try:
        kb_url = settings.knowledge_base_service_url
        search_url = f"{kb_url}/api/documents/search"
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                search_url,
                json={
                    "query": query,
                    "companyId": company_id,
                    "agentId": agent_id,
                    "topK": top_k,
                },
                headers={"Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=5),  # 5 second timeout
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    results = data.get("results", [])
                    
                    if results:
                        # Extract text from results
                        context_parts = []
                        for result in results:
                            metadata = result.get("metadata", {})
                            text = metadata.get("text", "")
                            if text:
                                context_parts.append(text)
                        
                        if context_parts:
                            context = "\n\n".join(context_parts)
                            return context
                
                logger.debug("No knowledge base results found", {
                    "agent_id": agent_id,
                    "status": response.status,
                })
                return None
                
    except (asyncio.TimeoutError, aiohttp.ClientError) as e:
        logger.warn("Knowledge base search failed", {
            "agent_id": agent_id,
            "error": str(e),
        })
        return None
    except Exception as e:
        logger.warn("Failed to retrieve knowledge base context", {
            "error": str(e),
            "agent_id": agent_id,
        })
        return None


def enhance_system_prompt_with_kb(
    system_prompt: str,
    kb_context: Optional[str]
) -> str:
    """
    Enhance system prompt with knowledge base context
    
    Args:
        system_prompt: Original system prompt
        kb_context: Knowledge base context to add
        
    Returns:
        Enhanced system prompt with KB context
    """
    if not kb_context:
        return system_prompt
    
    enhanced = system_prompt
    
    # Add KB context if not already present
    if "knowledge base" not in enhanced.lower() and "relevant context" not in enhanced.lower():
        enhanced += f"\n\nRelevant context from knowledge base:\n{kb_context}"
    else:
        # If KB context section exists, append to it
        enhanced += f"\n\n{kb_context}"
    
    return enhanced


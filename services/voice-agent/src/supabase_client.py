"""Supabase client for fetching agent configurations"""

import sys
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from supabase import create_client, Client
from typing import Optional, Dict, Any
from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """Get or create Supabase client"""
    global _supabase_client
    
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key
        )
    
    return _supabase_client

async def get_agent_config(agent_id: str, company_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch agent configuration from Supabase
    
    CRITICAL: company_id is required for data isolation.
    If provided, filters by company_id to ensure agents can only be accessed
    by users from the same company.
    
    Args:
        agent_id: Agent UUID
        company_id: Company UUID (optional but recommended for security)
    
    Returns:
        Agent configuration dictionary
    """
    try:
        supabase = get_supabase_client()
        
        query = supabase.table("agent_configs").select(
            "id, company_id, name, description, model, system_prompt, temperature, voice_settings"
        ).eq("id", agent_id)
        
        # CRITICAL: Filter by company_id if provided for data isolation
        if company_id:
            query = query.eq("company_id", company_id)
        
        response = query.single().execute()
        
        if not response.data:
            raise ValueError(f"Agent {agent_id} not found")
        
        config = response.data
        
        # Verify company_id matches if provided (defense in depth)
        if company_id and config.get("company_id") != company_id:
            logger.error("Agent company_id mismatch - potential security issue", {
                "agent_id": agent_id,
                "expected_company_id": company_id,
                "actual_company_id": config.get("company_id"),
            })
            raise ValueError(f"Agent {agent_id} does not belong to company {company_id}")
        
        return {
            "agent_id": config.get("id"),
            "company_id": config.get("company_id"),
            "name": config.get("name") or "AI Assistant",
            "description": config.get("description") or "",
            "model": config.get("model") or "gpt-4o-mini",
            "system_prompt": config.get("system_prompt") or "You are a helpful AI assistant.",
            "temperature": config.get("temperature") or 0.7,
            "voice_settings": config.get("voice_settings") or {},
        }
    except Exception as e:
        logger.error(f"Failed to fetch agent config: {e}", {
            "agent_id": agent_id,
            "company_id": company_id,
        })
        raise


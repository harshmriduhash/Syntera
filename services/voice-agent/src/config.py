"""Configuration management for voice agent service"""

import os
from typing import Optional
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    """Application settings"""
    
    # LiveKit Configuration
    livekit_url: str = os.getenv("LIVEKIT_URL", "")
    livekit_api_key: str = os.getenv("LIVEKIT_API_KEY", "")
    livekit_api_secret: str = os.getenv("LIVEKIT_API_SECRET", "")
    
    # Supabase Configuration
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # OpenAI Configuration
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    
    # ElevenLabs Configuration
    elevenlabs_api_key: Optional[str] = os.getenv("ELEVENLABS_API_KEY")
    
    # Service Configuration
    api_server_port: int = int(os.getenv("PORT") or os.getenv("API_SERVER_PORT", "4003"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Knowledge Base Service
    knowledge_base_service_url: str = os.getenv("KNOWLEDGE_BASE_SERVICE_URL", "")
    
    # Chat Service (for saving messages)
    chat_service_url: str = os.getenv("CHAT_SERVICE_URL", "")
    internal_service_token: str = os.getenv("INTERNAL_SERVICE_TOKEN", "")
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"

settings = Settings()

def validate_config() -> bool:
    """Validate that required configuration is present"""
    required = [
        settings.livekit_url,
        settings.livekit_api_key,
        settings.livekit_api_secret,
        settings.supabase_url,
        settings.supabase_service_role_key,
    ]
    
    if not all(required):
        return False
    
    return True

def validate_openai_config() -> bool:
    """Validate OpenAI API key is configured"""
    if not settings.openai_api_key:
        return False
    return True


"""
Sentry initialization for voice agent service
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_sentry_initialized = False

def init_sentry() -> None:
    """
    Initialize Sentry for error tracking
    Should be called once at application startup
    """
    global _sentry_initialized
    
    if _sentry_initialized:
        return
    
    sentry_dsn = os.getenv('SENTRY_DSN')
    if not sentry_dsn:
        logger.info('SENTRY_DSN not set, skipping Sentry initialization')
        return
    
    # Only initialize Sentry in production
    node_env = os.getenv('NODE_ENV', 'development')
    if node_env != 'production':
        return  # Skip Sentry initialization in development
    
    try:
        import sentry_sdk
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        
        sentry_sdk.init(
            dsn=sentry_dsn,
            environment='production',
            release=os.getenv('APP_VERSION'),
            traces_sample_rate=0.1,
            
            integrations=[
                LoggingIntegration(
                    level=logging.INFO,        # Capture info and above as breadcrumbs
                    event_level=logging.ERROR  # Send errors as events
                ),
                FastApiIntegration(),
            ],
            
            # Filter out known non-critical errors
            before_send=lambda event, hint: None if _should_filter_error(event, hint) else event,
        )
        
        _sentry_initialized = True
        logger.info('Sentry initialized successfully')
        
    except ImportError:
        logger.warning('sentry-sdk not installed, skipping Sentry initialization')
    except Exception as e:
        logger.error(f'Failed to initialize Sentry: {e}')


def _should_filter_error(event, hint) -> bool:
    """
    Filter out known non-critical errors
    """
    if 'exc_info' in hint and hint['exc_info']:
        exc_type, exc_value, _ = hint['exc_info']
        
        # Filter out expected exceptions
        if isinstance(exc_value, (KeyboardInterrupt, SystemExit)):
            return True
        
        # Filter out validation errors (these are expected)
        if 'ValidationError' in str(exc_type):
            return True
    
    return False


def set_sentry_user(user_id: str, email: Optional[str] = None, username: Optional[str] = None) -> None:
    """
    Set user context for Sentry
    """
    if not _sentry_initialized:
        return
    
    try:
        import sentry_sdk
        sentry_sdk.set_user({
            'id': user_id,
            'email': email,
            'username': username,
        })
    except Exception as e:
        logger.warning(f'Failed to set Sentry user: {e}')


def set_sentry_context(tags: Optional[dict] = None, extra: Optional[dict] = None) -> None:
    """
    Set additional context (tags, extra data)
    """
    if not _sentry_initialized:
        return
    
    try:
        import sentry_sdk
        with sentry_sdk.push_scope() as scope:
            if tags:
                for key, value in tags.items():
                    scope.set_tag(key, value)
            if extra:
                scope.set_extra(extra)
    except Exception as e:
        logger.warning(f'Failed to set Sentry context: {e}')


def capture_exception(error: Exception, **kwargs) -> None:
    """
    Capture an exception to Sentry
    """
    if not _sentry_initialized:
        return
    
    try:
        import sentry_sdk
        sentry_sdk.capture_exception(error, **kwargs)
    except Exception as e:
        logger.warning(f'Failed to capture exception to Sentry: {e}')


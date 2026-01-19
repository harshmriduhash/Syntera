"""LLM-based Contact Information Extractor for Voice Agent
Uses OpenAI to extract and validate contact information with error detection
"""

import json
from typing import Optional, Dict, Any, List
from openai import OpenAI
from config import settings
from utils.logger import setup_logger

logger = setup_logger(__name__)


class ExtractedContactInfo:
    """Extracted contact information"""
    def __init__(
        self,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        company_name: Optional[str] = None,
        confidence: Optional[float] = None,
        errors_detected: Optional[List[str]] = None,
        corrections_made: Optional[Dict[str, str]] = None
    ):
        self.email = email
        self.phone = phone
        self.first_name = first_name
        self.last_name = last_name
        self.company_name = company_name
        self.confidence = confidence
        self.errors_detected = errors_detected or []
        self.corrections_made = corrections_made or {}
    
    def has_contact_info(self) -> bool:
        """Check if any contact information was extracted"""
        return bool(self.email or self.phone or self.first_name or self.last_name or self.company_name)


async def extract_contact_info_llm(
    message_text: str,
    conversation_context: Optional[List[Dict[str, str]]] = None
) -> ExtractedContactInfo:
    """
    Extract contact information using LLM with structured output
    
    Args:
        message_text: The message text to analyze
        conversation_context: Optional list of previous messages for context
        
    Returns:
        ExtractedContactInfo object with extracted information
    """
    if not settings.openai_api_key:
        logger.warn("OpenAI API key not available, falling back to empty extraction")
        return ExtractedContactInfo()
    
    try:
        client = OpenAI(api_key=settings.openai_api_key)
        
        # Build context for better understanding
        context_text = ""
        if conversation_context:
            context_messages = conversation_context[-5:]  # Last 5 messages for context
            context_text = "\n".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in context_messages])
        
        prompt = f"""Extract contact information from the following message. Analyze the text carefully and extract any contact details mentioned.

CRITICAL REQUIREMENTS:
1. Extract email addresses - validate format and CORRECT common typos (e.g., "gmazil" -> "gmail", "gmial" -> "gmail", "yahooo" -> "yahoo")
2. Extract phone numbers - normalize to digits only (remove spaces, dashes, parentheses)
3. Extract names - identify first_name and last_name separately. Be careful not to extract random words as names (e.g., "interested about" is NOT a name)
4. Extract company names - only if explicitly mentioned as a company/organization
5. Detect and correct errors in contact information
6. Only extract information that is CLEARLY contact information, not random words from the conversation

Respond with ONLY a JSON object in this exact format:
{{
  "email": "corrected-email@domain.com" or null,
  "phone": "digits-only-phone" or null,
  "first_name": "actual first name" or null,
  "last_name": "actual last name" or null,
  "company_name": "company name" or null,
  "confidence": 0.0 to 1.0,
  "errors_detected": ["list of errors found"],
  "corrections_made": {{"original": "corrected"}} or {{}}
}}

IMPORTANT:
- If email has typos, correct them (e.g., "wambstephane@gmazil.com" -> "wambstephane@gmail.com")
- If name extraction is uncertain (confidence < 0.7), set to null
- Do NOT extract words like "interested", "about", "products" as names
- Only extract if you're confident it's actual contact information
- confidence should reflect how certain you are about the extraction

"""
        
        if context_text:
            prompt += f"\nConversation context:\n{context_text}\n"
        
        prompt += f'Message to analyze: "{message_text}"\n\nJSON response:'

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a contact information extraction system. Extract and validate contact information from text. Always correct typos in emails and phone numbers. Respond with valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.1,  # Low temperature for consistent, accurate extraction
            max_tokens=300,
            response_format={"type": "json_object"}
        )
        
        response_text = completion.choices[0].message.content.strip() if completion.choices[0].message.content else "{}"
        result = json.loads(response_text)
        
        # Validate and clean the extracted data
        extracted = ExtractedContactInfo()
        
        if result.get("email") and result["email"] != "null" and "@" in str(result["email"]):
            extracted.email = str(result["email"]).lower().strip()
        
        if result.get("phone") and result["phone"] != "null":
            # Ensure phone is digits only
            phone_digits = "".join(filter(str.isdigit, str(result["phone"])))
            if len(phone_digits) >= 10:
                extracted.phone = phone_digits
        
        # Only include names if confidence is high enough
        confidence = result.get("confidence", 0.0)
        if result.get("first_name") and result["first_name"] != "null" and confidence >= 0.7:
            extracted.first_name = str(result["first_name"]).strip()
        
        if result.get("last_name") and result["last_name"] != "null" and confidence >= 0.7:
            extracted.last_name = str(result["last_name"]).strip()
        
        if result.get("company_name") and result["company_name"] != "null":
            extracted.company_name = str(result["company_name"]).strip()
        
        if "confidence" in result:
            extracted.confidence = float(result["confidence"])
        
        if result.get("errors_detected"):
            extracted.errors_detected = result["errors_detected"]
        
        if result.get("corrections_made"):
            extracted.corrections_made = result["corrections_made"]
        
        
        return extracted
        
    except Exception as e:
        logger.error(f"Failed to extract contact info with LLM: {e}", exc_info=True)
        return ExtractedContactInfo()


def merge_contact_info(
    existing: Dict[str, Any],
    extracted: ExtractedContactInfo
) -> Dict[str, Any]:
    """
    Merge extracted contact info with existing metadata
    Only adds new info, doesn't overwrite existing
    """
    merged = existing.copy()
    
    # Only add if not already present
    if extracted.email and not merged.get("email"):
        merged["email"] = extracted.email
    if extracted.phone and not merged.get("phone"):
        merged["phone"] = extracted.phone
    if extracted.first_name and not merged.get("first_name"):
        merged["first_name"] = extracted.first_name
    if extracted.last_name and not merged.get("last_name"):
        merged["last_name"] = extracted.last_name
    if extracted.company_name and not merged.get("company_name"):
        merged["company_name"] = extracted.company_name
    
    return merged

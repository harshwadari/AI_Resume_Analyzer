import hmac
import os
from fastapi import Header, HTTPException

def authorize(x_ai_service_token: str = Header(default='')):
    token = os.getenv('AI_SERVICE_TOKEN', '')
    if len(token) < 32:
        raise HTTPException(503, 'AI service is not configured.')
    if not hmac.compare_digest(token.encode(), x_ai_service_token.encode()):
        raise HTTPException(401, 'Unauthorized service request.')

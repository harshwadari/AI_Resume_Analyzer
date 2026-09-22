import os
import re
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
from app.models.jd import ExtractionRequest, ExtractionResponse, Requirements
from app.services.gemini import generate_requirements

PARSER_VERSION = 'jd-v1'
router = APIRouter()

@router.post('/v1/jd/extract', response_model=ExtractionResponse)
async def extract(request: ExtractionRequest):
    key = os.getenv('GOOGLE_GEN_API_KEY', '')
    model = os.getenv('JD_MODEL', 'gemini-2.5-flash')
    if not key or not re.fullmatch(r'[A-Za-z0-9._-]{1,100}', model):
        raise HTTPException(503, 'JD model is not configured.')
    try:
        raw = await generate_requirements(request.rawJDText, model, key)
        if len(raw) > 100000:
            raise ValueError('Oversized response')
        structured = Requirements.model_validate_json(raw)
    except httpx.TimeoutException:
        raise HTTPException(504, 'JD extraction timed out. Please retry.') from None
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, ValidationError):
        raise HTTPException(502, 'JD extraction returned an invalid or unavailable result. Please retry.') from None
    return ExtractionResponse(structuredJD=structured, parserVersion=PARSER_VERSION,
                              modelName=model, extractedAt=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'))

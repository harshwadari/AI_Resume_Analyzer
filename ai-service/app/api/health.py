from fastapi import APIRouter
from app.models.health import HealthResponse

router = APIRouter()


@router.get('/health', response_model=HealthResponse)
async def health():
    # Liveness only: no Gemini call, database access, or secrets in the response.
    return HealthResponse()

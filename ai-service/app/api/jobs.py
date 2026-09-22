import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from app.services.processing import dispatch_job

router = APIRouter()


class JobRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    jobId: str = Field(pattern=r'^[a-f0-9]{24}$')


@router.post('/v1/jobs', status_code=202)
def enqueue(request: JobRequest):
    if not os.getenv('REDIS_URL') or not os.getenv('MONGO_URI'):
        raise HTTPException(503, 'Processing queue is not configured.')
    try:
        dispatch_job.apply_async(args=[request.jobId], task_id=f'dispatch:{request.jobId}')
    except Exception:
        raise HTTPException(503, 'Processing queue is unavailable.') from None
    return {'jobId': request.jobId, 'status': 'ACCEPTED'}

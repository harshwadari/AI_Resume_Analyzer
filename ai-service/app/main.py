"""Independent private AI application; Node remains the public product API."""
from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.api import health, jd, jobs
from app.core.security import authorize

# Protect all application routes by default, including future AI routers.
app = FastAPI(title='PrepWise AI service', docs_url=None, redoc_url=None,
              openapi_url=None, dependencies=[Depends(authorize)])


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    return JSONResponse(status_code=422, content={'detail': 'Invalid request.'})


app.include_router(health.router)
app.include_router(jd.router)
app.include_router(jobs.router)

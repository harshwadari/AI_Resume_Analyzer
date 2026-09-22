# Checkpoint 7 — Python AI service foundation

The existing Checkpoint 6 Python service is now organized under `ai-service/app`, with `main.py`, `api`, `models`, `services`, `core`, and reserved `parsers`, `retrieval`, `ranking`, and `rag` packages. No Node upload, PDF extraction, database, authentication, or candidate functionality was moved to Python. The existing JD-understanding endpoint is preserved.

## Health and internal authentication

Added Python `GET /health`, returning `{"status":"ok","service":"prepwise-ai"}` through a Pydantic response model. This is process liveness, independent of Gemini and MongoDB. Authentication is now installed on the FastAPI application, protecting health, existing extraction, and future routers by default. Missing/wrong tokens return 401; unconfigured credentials return 503. Interactive docs/OpenAPI endpoints remain disabled.

Node uses the shared internal HTTP client in `Backend/src/services/ai-client.service.js` for health and JD extraction. It sends the existing `X-AI-Service-Token`, rejects redirects, applies timeouts, validates health responses, and sanitizes errors. Run `node scripts/check-ai-health.js` from `Backend` to verify connectivity. No new public Node endpoint is exposed; the existing Node `/health` is unchanged.

## Setup and compatibility

See `ai-service/README.md` for complete setup. From `ai-service`, start with `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`, after installing `requirements.txt` and setting `AI_SERVICE_TOKEN`. Node requires the matching token and `AI_SERVICE_URL`. Health requires no Gemini key. JD extraction still requires `GOOGLE_GEN_API_KEY` in the Python environment.

- Dependencies: no additions beyond the four Python requirements from Checkpoint 6; Node dependencies unchanged.
- Environment variables: none added; reuses `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `GOOGLE_GEN_API_KEY`, and `JD_MODEL`.
- Database/schema changes: none.
- Product API contracts: unchanged. Internal API addition: protected Python `/health`.
- Deployment change: update service working directory from `AIService` to `ai-service` and launch target from `app:app` to `app.main:app`. Old launch commands will no longer work.
- Startup remains independent. A missing AI configuration blocks protected Python calls but does not prevent Node/candidate functionality from starting.
- No new retrieval, ranking, RAG, batch processing, or document parsing behavior is implemented in the reserved packages.

## Verification

- Python: 8 tests passed, preserving JD validation tests and adding health/auth checks.
- Live local integration: an actual independent Uvicorn subprocess started; the actual Node health client received the expected health JSON. Missing/wrong credentials were rejected. The subprocess was stopped after verification.
- Backend: 45 tests passed, including Checkpoint 6 extraction through the refactored Node client.
- Frontend: 51 tests passed.
- Frontend production build passed. Frontend source was unchanged in this checkpoint.
- Synthetic credentials and isolated test database only; no deployment or live Gemini call.

## Changed files

Moved unchanged from `AIService` to `ai-service`:
- `.gitignore`
- `.env.example`
- `requirements.txt`
- `tests/requirements.json`

Moved/updated: `AIService/tests/test_app.py` → `ai-service/tests/test_app.py` (new module imports/mock targets).

Replaced `AIService/app.py` with:
- `ai-service/app/main.py`
- `ai-service/app/api/jd.py`
- `ai-service/app/models/jd.py`
- `ai-service/app/services/gemini.py`
- `ai-service/app/core/security.py`

Added:
- `ai-service/app/api/health.py`
- `ai-service/app/models/health.py`
- `ai-service/app/__init__.py`
- `ai-service/app/api/__init__.py`
- `ai-service/app/models/__init__.py`
- `ai-service/app/services/__init__.py`
- `ai-service/app/core/__init__.py`
- `ai-service/app/parsers/__init__.py`
- `ai-service/app/retrieval/__init__.py`
- `ai-service/app/ranking/__init__.py`
- `ai-service/app/rag/__init__.py`
- `ai-service/tests/test_health.py`
- `ai-service/README.md`
- `Backend/src/services/ai-client.service.js`
- `Backend/scripts/check-ai-health.js`
- `CHECKPOINT_7.md`

Updated:
- `Backend/src/services/jd-ai.service.js` (reuses shared internal client)
- `Backend/test/database.test.js` (fixture path)
- `PROJECT_CONTEXT.md` (current checkpoint/start command)
- `CHECKPOINT_6.md` (link to current setup)

Earlier checkpoint changes remain in the working tree and are not additional changes for this checkpoint.

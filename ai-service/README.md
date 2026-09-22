# PrepWise AI service

Independent Python/FastAPI service. Node remains the main API and owns user authentication, MongoDB, and existing file uploads. This reorganizes the Checkpoint 6 service previously named `AIService`; use the new path and Uvicorn import below.

## Start independently

From `ai-service`, with Python 3.12:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
$env:AI_SERVICE_TOKEN = '<random shared secret: at least 32 characters>'
.venv/Scripts/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Generate the shared secret using a password manager or `python -c "import secrets; print(secrets.token_hex(32))"`. Supply it to both services through their process environment or deployment secret manager. The `.env.example` is a reference; Python does not automatically load it. Do not commit secrets or put them in frontend variables.

For existing JD extraction, also set `GOOGLE_GEN_API_KEY` and optionally `JD_MODEL` (default `gemini-2.5-flash`). Neither Gemini credentials nor a database is needed to start or check health.

In the backend `.env`, set `AI_SERVICE_URL=http://127.0.0.1:8000` and the same `AI_SERVICE_TOKEN`. From `Backend`:

```powershell
node scripts/check-ai-health.js
```

Expected output: `{"status":"ok","service":"prepwise-ai"}`. Failure produces a sanitized error and a nonzero exit code. The health client has a five-second timeout. The existing Node `/health` remains unchanged.

## API and authentication

- `GET /health`: authenticated liveness check; returns the Pydantic health response. It does not claim Gemini availability.
- `POST /v1/jd/extract`: existing validated JD extraction contract, unchanged.
- All application routes require `X-AI-Service-Token`, compared with a constant-time function. Missing/wrong credentials return 401; absent or too-short server configuration returns 503.
- Authentication is installed at application level so future routers inherit protection. OpenAPI/docs endpoints are disabled. There is no public AI endpoint or new user login system.
- Bind locally for development. In deployment, use private networking with appropriate firewall rules and HTTPS across untrusted networks. Keep secrets out of logs and browser code.

## Layout

```text
ai-service/
  app/
    main.py
    api/          # health and JD routes
    models/       # Pydantic request/response models
    services/     # Gemini provider call
    core/         # internal service authentication
    parsers/      # reserved package; no Node parser moved
    retrieval/    # reserved package
    ranking/      # reserved package
    rag/          # reserved package
  tests/
  requirements.txt
```

Test from this directory with `python -m unittest discover -s tests -v`. Tests use synthetic provider responses. The health integration test launches an actual Uvicorn process, calls it using the Node client, checks rejected credentials, and stops the process. Node must be installed and backend dependencies available. No real Gemini requests or production database connections occur.

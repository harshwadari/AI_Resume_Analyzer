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

## Resume processing worker

Checkpoint 11 uses Celery and Redis as the single background queue. Start one worker with the same `MONGO_URI`, `MONGO_DB_NAME`, `RESUME_STORAGE_DIR`, and `REDIS_URL` values:

```powershell
.venv/Scripts/python -m celery -A app.core.celery_app.celery worker -Q resume-processing --pool=threads --concurrency=2 --loglevel=INFO
```

Run one beat process to reconcile durable MongoDB jobs every 30 seconds:

```powershell
.venv/Scripts/python -m celery -A app.core.celery_app.celery beat --loglevel=INFO
```

Each resume has a deterministic task ID, a MongoDB lease, a maximum of three document attempts, and a per-file error. The frontend polls the Node progress endpoint and displays completed, extracted, OCR-required, queued, processing, and failed counts.

Use a Linux worker for deployment (the Windows threads command above is for local development). Run one worker with `--concurrency=2 --prefetch-multiplier=1`; adding worker replicas increases total concurrency. Run one beat instance. Configure persistent Redis storage and mount the same private resume directory into Node and the worker. The Python Mongo URI/database must point to the same database as Node. A running health endpoint alone does not mean Redis or the worker is available.

Transient read/timeout errors retry with backoff. MongoDB records retain pending publication intent across broker outages; beat recovers due retries, expired 120-second processing leases, and publication reservations older than five minutes. At-least-once delivery is expected: Mongo claims and claim tokens, rather than task IDs alone, prevent duplicate writes. Existing originals remain available. This checkpoint extracts raw text; candidate matching and AI requests are not performed.

For the reproducible isolated queue test, install `requirements-test.txt` in this virtual environment, then run from `Backend`:

```powershell
$env:CHECKPOINT11_QUEUE_TEST = '1'
node --test --test-name-pattern='Checkpoint 11' test/database.test.js
```

The harness uses real HTTP uploads, FastAPI, Celery workers, PDF extraction subprocesses, and an isolated MongoDB replica set. Set `TEST_REDIS_SERVER` to an absolute `redis-server` executable path to run a private real Redis process, verify queue persistence across a Redis restart, and restart the worker mid-batch. With this variable omitted, the harness uses fakeredis TCP with RESP2/Lua support. Both modes passed the 100-PDF flow; see `../CHECKPOINT_11.md` for exact evidence and the local Redis build/checksum. Frontend DOM tests separately verify polling and rendering. Ordinary Node test runs skip the optional integration test; no production database or Gemini API is used.

## Resume text extraction (Checkpoint 12)

Install the updated `requirements.txt` and restart the worker when upgrading: `PyMuPDF==1.28.2` replaces the earlier `pypdf` parser. The supported import is `pymupdf` (the library is also historically known as `fitz`). Do not install the unrelated package named `fitz`.

The existing isolated worker subprocess extracts PDF text with `page.get_text('text', sort=True)`. MongoDB stores validated output on each resume:

- `rawText`: exact extracted page strings joined with a form-feed character (`\f`) between pages.
- `pages`: every page, including empty ones, as `{pageNumber, text}` with consecutive one-based PDF page numbers.
- `documentMetadata`: `pageCount`, `format`, `title`, `author`, `subject`, `keywords`, `creator`, `producer`, `creationDate`, `modDate`, and `trapped`. PDF date strings are retained as supplied by the document; unavailable text metadata is an empty string.
- `parserVersion`: `resume-text-v2-pymupdf`; `processedAt`: the worker completion timestamp.

Pydantic validates the subprocess response, page count/order, bounded text/metadata, exact raw-text/page correspondence and extraction outcome before persistence. Existing private original files are read without rewriting them. Raw text, pages and document metadata are excluded from ordinary Mongoose queries and paginated resume responses.

At least one Unicode letter is required for usable text; whitespace, replacement glyphs, punctuation and page numbers alone produce terminal `OCR_REQUIRED`. This is a text-presence check, not a measure of candidate or resume quality. The frontend identifies those files and counts them separately from `FAILED`. Jobs with OCR-required files finish as `COMPLETED_WITH_ERRORS`; completed counts include those files. Automatic retries and the retry-failed action do not queue OCR-required records. No OCR engine or AI matching is included.

Mixed PDFs retain empty image pages and remain `PROCESSED` if other pages have text. Spatial text sorting is an approximation of reading order, not a semantic layout parser. Existing 5 MiB, 50-page, 100,000-text-character and 35-second limits remain; each metadata string is limited to 10,000 characters. Oversized output fails rather than being silently truncated. Unreadable or encrypted PDFs fail individually.

Existing v1 records remain unchanged and have no fabricated page boundaries. Upload a new copy and process it to generate v2 extraction data; this checkpoint does not run a migration or automatically reprocess old resumes.

The optional queue test above now also uploads a three-page text resume (including a blank page and a rotated page) and an image-only resume through HTTP. It verifies stored page text/metadata, `OCR_REQUIRED`, separate progress counts, and unchanged original bytes with real MongoDB and Celery. See `../CHECKPOINT_12.md` for the verification report.

## API and authentication

- `GET /health`: authenticated liveness check; returns the Pydantic health response. It does not claim Gemini availability.
- `POST /v1/jd/extract`: existing validated JD extraction contract, unchanged.
- `POST /v1/jobs`: protected internal publication request containing a validated MongoDB job ID; returns 202 or a sanitized 503.
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
    parsers/      # bounded resume PDF text extraction
    retrieval/    # reserved package
    ranking/      # reserved package
    rag/          # reserved package
  tests/
  requirements.txt
```

Test from this directory with `python -m unittest discover -s tests -v`. Tests use synthetic provider responses. The health integration test launches an actual Uvicorn process, calls it using the Node client, checks rejected credentials, and stops the process. Node must be installed and backend dependencies available. No real Gemini requests or production database connections occur.

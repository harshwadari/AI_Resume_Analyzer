# Checkpoint 11 — asynchronous processing verification

Verified on 2026-09-22. Functional verification uses synthetic resumes and an isolated database; it does not touch application accounts or invoke AI providers.

## Ownership and behavior

Node owns authenticated product APIs and durable MongoDB job creation. Node calls the protected FastAPI enqueue endpoint. Python owns the only queue (Celery + Redis), dispatch, processing, retry scheduling and MongoDB result updates. There is no BullMQ queue.

Each job snapshots its resume IDs. Repeated/concurrent start requests reuse active jobs. Deterministic task IDs provide traceability; Mongo atomic claims and per-attempt tokens provide idempotency. Duplicate terminal deliveries skip extraction. Expired 120-second leases recover abandoned work and stale workers cannot overwrite a newer result.

One worker runs with concurrency two, prefetch one and late acknowledgements. Batches of 1,000 are queued instead of creating 1,000 simultaneous requests. Additional worker replicas multiply the total concurrency; use one worker initially. Processing currently extracts raw PDF text, without AI calls, candidate matching or ranking.

Transient file access/timeouts allow three attempts with backoff. Permanent malformed, encrypted, oversized or textless PDFs fail individually. Parser processes have a 35-second timeout; stdin is disconnected, and Windows timeout cleanup includes the child interpreter. Linux parsing additionally has CPU/memory limits. Original files are preserved.

MongoDB retains publication intent if FastAPI/Redis is unavailable. One Celery beat instance reconciles every 30 seconds, recovering due retries, expired processing leases and queued publication reservations older than five minutes. Deployment should use persistent Redis storage and a shared private resume volume.

## Verification evidence

- Cross-service test uploads 100 real synthetic PDFs as a ZIP through authenticated Express routes, creates jobs through Node → FastAPI → Celery, extracts PDF text in subprocesses, and polls progress stored in a real isolated MongoDB replica set. Observed 0/100 → intermediate counts → 100/100, maximum two processing files, each successful resume processed once, originals retained.
- It also checks owner isolation, request validation, concurrent start idempotency, durable job creation during a queue-request outage, subsequent uploads, individual failure filename/reason, and retrying only failed files.
- Python tests exercise backoff/exhaustion, duplicate delivery, active and expired leases, stale worker protection, publication failure recovery, parser timeout cleanup, actual text extraction, malformed/oversized files, and internal API authentication/validation.
- Frontend DOM tests exercise 0/100 → intermediate counts → 100/100, failure reasons/attempts, page 2 preservation while polling, processing subsequent uploads, failed-file retries, overlapping-request prevention and unmount cancellation.

**Real Redis acceptance test passed.** The final run used Redis 8.2.10, real Celery and isolated MongoDB. It recorded 57 progress snapshots from 0/100 to 100/100, observed maximum concurrency two, preserved all original files, and confirmed every successful resume was processed once. Queued tasks survived a Redis restart with append-only persistence enabled. A graceful worker restart during the batch resumed the remaining work. Individual failures, manual failed-file retry, concurrent-start idempotency and durable creation during a publication outage also passed.

The broker executable is the portable [Redis 8.2.10 Windows build](https://github.com/redis-windows/redis-windows/releases/tag/8.2.10), compiled from Redis source by the redis-windows project. Its archive SHA256 was verified against the published value: `92D9BDDE87ED52BF859A677E5197D8AC855BA78D9940D457881723AE960DF429`. It runs only on loopback in an isolated test directory and was stopped after verification; no Windows service or system settings were installed. The downloaded files are ignored under `ai-service/.test-tools/`. This community build is for local verification; deploy the worker/Redis on the supported Linux environment described in the README.

The earlier fakeredis TCP acceptance run also passed (54 snapshots), and remains an optional portable test mode. Frontend DOM tests separately verify actual React progress rendering using controlled API responses; no manual browser upload or production deployment is claimed.

Final results: **51 backend tests passed**, **59 frontend tests passed**, **17 Python tests passed**, production frontend build passed, and targeted lint passed. The real Redis acceptance test additionally passed with broker and worker restarts.

Run the integration test from `Backend` after installing `ai-service/requirements-test.txt` into `ai-service/.venv`:

```powershell
$env:CHECKPOINT11_QUEUE_TEST = '1'
$env:TEST_REDIS_SERVER = 'C:\absolute\path\to\redis-server.exe'
npm test
```

Ordinary Node tests skip that optional integration test. Set `TEST_REDIS_SERVER` to run a fresh real Redis process with isolated data, persistence and restart checks; omit it for fakeredis TCP. Use `TEST_PYTHON` to specify another Python executable if needed. These variables affect tests only. Python tests: `.venv/Scripts/python -m unittest discover -s tests -v` from `ai-service`. Frontend tests: `npm test` from `Frontend`.

Production build verification uses the process-only synthetic origin `VITE_API_URL=https://example.com`; the existing local HTTP development value is rejected by production configuration validation. No saved environment values were changed. Full frontend lint has existing errors in `Interview.jsx` and `theme.context.jsx`; the changed recruiter/test files pass targeted lint. The existing bundle-size warning remains.

## API and data changes

- Added authenticated `POST /api/recruiter/analyses/:analysisId/processing` with `{retryFailed?: boolean}`; returns 202 with job/progress. Added owner-scoped `GET` at the same path.
- Added protected internal `POST /v1/jobs` with a validated job ID. Existing APIs remain compatible; resume list/upload serialization adds job ID, attempts and processing error.
- Added MongoDB `processingjobs` collection: analysis, recruiter, immutable resume-ID snapshot, status, dispatch error, timestamps.
- Analysis adds `processingJobId`.
- Resume adds `jobId`, `attempts`, `processingError`, `processedAt`, `parserVersion`, private `rawText`, `publishedAt`, `nextAttemptAt`, `leaseUntil`, `claimToken`. Existing `UPLOADED → PROCESSING → PROCESSED/FAILED` status values are reused. Retryable failures temporarily return to UPLOADED. No destructive migration is required.
- Python runtime dependencies: `celery[redis]==5.6.3`, `pymongo==4.18.1`, `pypdf==6.19.0`. Test dependencies: `mongomock==4.3.0`, `fakeredis[lua]==2.38.0` (Lua extra installs `lupa`). No Node/frontend dependencies added.
- Python environment: `REDIS_URL`, `MONGO_URI`, optional `MONGO_DB_NAME`, and `RESUME_STORAGE_DIR`. Node's existing AI service URL/token and resume storage configuration are reused. These are documented in `ai-service/.env.example`; Python does not automatically load `.env`.

## Files in this checkpoint

- `Backend/src/Routes/recruiter.routes.js`
- `Backend/src/controllers/resume.controller.js`
- `Backend/src/models/analysis.model.js`
- `Backend/src/models/resume.model.js`
- `Backend/src/models/processingJob.model.js`
- `Backend/src/services/processing.service.js`
- `Backend/test/database.test.js`
- `Frontend/src/features/recruiter/components/ProcessingProgress.jsx`
- `Frontend/src/features/recruiter/components/ResumeUploads.jsx`
- `Frontend/src/features/recruiter/pages/AnalysisOverview.jsx`
- `Frontend/src/features/recruiter/pages/NewAnalysis.jsx`
- `Frontend/src/features/recruiter/services/analysis.api.js`
- `Frontend/test/dashboard.test.jsx`
- `Frontend/test/processing.test.jsx`
- `ai-service/.env.example`
- `ai-service/.gitignore`
- `ai-service/README.md`
- `ai-service/requirements.txt`
- `ai-service/requirements-test.txt`
- `ai-service/app/main.py`
- `ai-service/app/api/jobs.py`
- `ai-service/app/core/celery_app.py`
- `ai-service/app/core/database.py`
- `ai-service/app/parsers/resume_pdf.py`
- `ai-service/app/services/processing.py`
- `ai-service/tests/queue_harness.py`
- `ai-service/tests/redis_fixture.py`
- `ai-service/tests/test_health.py`
- `ai-service/tests/test_jobs.py`
- `ai-service/tests/test_processing.py`
- `PROJECT_CONTEXT.md`
- `CHECKPOINT_11.md`

This verification fixed retry publication recovery, overlapping polling, pagination resets, missing failure details, subsequent-upload controls, misleading static status text, and the inherited-input PDF subprocess stall. Authentication/candidate features were not refactored. Completion counts include both successes and failures, as explicitly labeled in the UI.

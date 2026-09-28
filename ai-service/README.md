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

## Resume text extraction and OCR (Checkpoints 12–13)

Install the updated `requirements.txt` and restart the worker when upgrading: `PyMuPDF==1.28.2` replaces the earlier `pypdf` parser. The supported import is `pymupdf` (the library is also historically known as `fitz`). Do not install the unrelated package named `fitz`.

The existing isolated worker subprocess extracts PDF text with `page.get_text('text', sort=True)`. MongoDB stores validated output on each resume:

- `rawText`: exact extracted page strings joined with a form-feed character (`\f`) between pages.
- `pages`: every page, including empty ones, as `{pageNumber, text}` with consecutive one-based PDF page numbers.
- `documentMetadata`: `pageCount`, `format`, `title`, `author`, `subject`, `keywords`, `creator`, `producer`, `creationDate`, `modDate`, and `trapped`. PDF date strings are retained as supplied by the document; unavailable text metadata is an empty string.
- `parserVersion`: `resume-text-v3-ocr`; `processedAt`: the worker completion timestamp.

Pydantic validates the subprocess response, page count/order, bounded text/metadata, exact raw-text/page correspondence and extraction outcome before persistence. Existing private original files are read without rewriting them. Raw text, pages and document metadata are excluded from ordinary Mongoose queries and paginated resume responses.

Checkpoint 13 adds page-level OCR fallback through a replaceable `OcrProvider` interface. Native text is tried first. A conservative text-presence check requires 12 Unicode letters (or five CJK characters), with no more replacement glyphs than letters. This is a routing heuristic, not a resume-quality or hiring score. Sufficient native text bypasses OCR completely. Empty pages keep their page numbers without invoking OCR. Insufficient nonblank pages use local Tesseract through PyMuPDF; normalized OCR text keeps line breaks and Unicode. No documents are sent to an external OCR provider.

Mixed PDFs retain native text and OCR only insufficient pages. MongoDB stores `extractionMethod: "text" | "ocr"`; `ocr` means at least one page contributed usable OCR text. `ocrRequiredPages` privately records unresolved pages. Missing language data, unreadable scans and page rendering limits remain `OCR_REQUIRED`, including partially extracted documents. The UI explains incomplete extraction; **Retry failed / OCR files** explicitly retries these and failed files after configuration is corrected. They are not automatically retried indefinitely. Completely blank PDFs also remain `OCR_REQUIRED`.

Existing 5 MiB, 50-page, 100,000-text-character and 10,000-character metadata limits remain. OCR renders at 200 DPI with a 16-million-pixel cap per page. The parser has a 95-second wall timeout (90-second CPU limit on Unix), below the 120-second worker lease. Worker concurrency remains two. Timeout retries remain bounded. Complex or large scans can exceed these limits; low-quality images, unsupported languages and unusual layouts may need a clearer PDF. Text sufficiency does not detect every corrupt text layer. Originals are never rewritten; spatial reading order remains approximate.

Existing processed records remain untouched, without a migration or fabricated extraction methods. Explicitly retry previous `OCR_REQUIRED` files, or upload a new copy of an older processed resume to apply v3 extraction.

### Enable OCR once

From `ai-service`:

```powershell
.venv/Scripts/python scripts/setup_ocr.py
```

This downloads the pinned, checksum-verified English [tessdata_fast 4.1.0 model](https://github.com/tesseract-ocr/tessdata_fast/tree/4.1.0) (Apache-2.0) to ignored `.ocr/tessdata/eng.traineddata`. Do this during setup/deployment, never in a request. PyMuPDF already includes the OCR runtime; only language data is needed when an explicit tessdata path is supplied ([PyMuPDF documentation](https://pymupdf.readthedocs.io/en/latest/installation.html#enabling-integrated-ocr-support)). No extra Python/npm package or running service is added.

Optional worker environment settings: `OCR_PROVIDER=tesseract` (default; `disabled` disables fallback), `OCR_LANGUAGES=eng` (use `eng+spa` with corresponding installed data), `OCR_TESSDATA_DIR` (absolute directory override; otherwise `TESSDATA_PREFIX` or the project-local directory). Python does not automatically load `.env`. Install data on every worker host/shared image and restart Celery after code/config changes. The API health endpoint remains a liveness check, not an OCR readiness check.

The optional queue test also uploads a three-page text resume and an image-only resume through HTTP, verifies real OCR, MongoDB methods/pages, separate progress counts and unchanged originals. Run setup above before the optional queue test. Unit tests always cover the injectable adapter and no-OCR native path; the real-engine unit test skips explicitly when English data is missing. See `../CHECKPOINT_13.md` for the checkpoint report.

## Structured profiles and semantic chunks (Checkpoints 14–15)

New resume processing continues from native/OCR extraction into candidate extraction using the existing Gemini API. The worker requires `GOOGLE_GEN_API_KEY`; optional `RESUME_MODEL` defaults to `gemini-2.5-flash`. Set these in the Celery worker environment as well as the API environment and restart the worker. No new package, queue, or running service is required. Processing sends extracted resume pages to the configured Gemini model. Profiles are intended for recruiter review, not hiring decisions.

Each profile has the requested candidate/contact fields, skills, job titles, explicit total experience, experiences, education, projects, certifications, domains, languages and unchanged `rawText`. Missing scalars are `null`; empty collections are `[]` (shown as unknown/not stated). `totalExperience` is an explicit quoted duration such as `5 years of experience`, or null; it is not calculated from potentially overlapping employment. Dates retain source wording, including `Present`. Experiences, projects and education carry numbered-page evidence. Every non-null string must be supported by source text; entry fields must also appear in that entry's evidence. Responses use structured JSON and strict local Pydantic limits, followed by grounding checks. Invalid results never become stored profiles.

The worker stores profiles and chunks atomically on the existing resume record, scoped to its analysis and recruiter. `candidateId` equals `resumeId`, representing one candidate document within this analysis; this is not cross-analysis identity matching. Profile metadata includes parser version, requested model, actual returned model version and extraction timestamp. Original text is persisted even when model processing fails. OCR-required documents do not call the model. Concurrency stays two, the worker lease is 240 seconds, Redis visibility is 300 seconds, and the model stage has a 65-second deadline. Three attempts remain the limit. Rate limits wait at least 60 seconds (numeric Retry-After respected up to 300); failures are visible and explicitly retryable.

Chunking uses section headings (including inline headings) and validated individual job/project/education evidence anchors, never fixed character windows. Headings stay with their first entry. Each chunk has `analysisId`, `resumeId`, `candidateId`, `section`, `pageStart`, `pageEnd`, `chunkIndex`, `text`, plus exact `sourceStart`/`sourceEnd` offsets. Unknown/contact material stays as `other`; unrecognized layouts are preserved rather than discarded. Joining chunks by `chunkIndex` exactly reconstructs rawText, including whitespace and page separators. A SHA-256 source hash and chunker version are stored. This reconstructs extracted text, not the original PDF's visual layout; the original PDF remains unchanged.

After processing, click **View candidate profile** on a resume to inspect fields/evidence, source chunks and raw text. The owner-protected Node endpoint is `GET /api/recruiter/analyses/:analysisId/resumes/:resumeId`. List responses include only a `hasProfile` flag, not profile content. Existing successfully processed resumes are left untouched; upload/process a new copy to produce profiles. There is no migration or automatic reprocessing of old data.

Ten fictional resumes were sent to the real Gemini model and manually inspected. Source fixtures and reviewed outputs are saved under `tests/review_resumes.py` and `tests/fixtures/candidate_review.json`. Run the explicit live review with `.venv/Scripts/python scripts/review_candidates.py --live --synthetic --limit 10`; cached successful outputs in ignored `.review/synthetic` are reused. It never reads private PDFs in synthetic mode. Without `--synthetic`, the script targets stored resumes; use that mode only with authorization to send those documents to Gemini. It does not write MongoDB or alter originals. See `../CHECKPOINT_14_15.md` for review findings, all changed files and verification.

## API and authentication (existing)

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

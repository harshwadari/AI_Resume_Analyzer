# Run and test PrepWise through checkpoint 15

## Port issue found and fixed

Port 8000 was occupied by another Python service. Its `/health` returned `{"status":"healthy","models_loaded":true}`, even without PrepWise's token. This is not PrepWise. A local bind attempt also reported that 8000 was already in use. Do not start another server there or stop that other application just to run PrepWise.

`Backend/.env` now uses `AI_SERVICE_URL=http://127.0.0.1:8001`. Backend/Python shared tokens matched, were long enough, and were not changed. Mongo URI values matched and Python's storage directory correctly points to Backend's private resume directory. PrepWise started successfully on 8001, and the existing Node health check returned `{"status":"ok","service":"prepwise-ai"}`. This verifies the private connection; it does not test Gemini quota or the worker. Redis was not responding on its configured localhost:6379 and must be started for processing.

Restart the backend after changing its `.env`; an already-running Node process still has the old URL. The frontend does not call Python directly, so do not change its API URL to port 8001.

## Start the application

Keep each long-running command in a separate terminal. A terminal showing server/worker logs instead of a new prompt is normal: leave it running. Stop your own old instances with Ctrl+C before starting replacements. Do not run duplicate workers or beat instances.

### Terminal 1 — Redis (local development)

This machine already has the portable Redis executable used for the queue tests. Use it locally; the data directory below persists the development queue. If you already have working Redis on 6379, keep that instance and skip this command.

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\ai-service"
$redisExecutable = (Resolve-Path '.\.test-tools\redis\Redis-8.2.10-Windows-x64-cygwin\redis-server.exe').Path
New-Item -ItemType Directory -Force '.\.redis-data' | Out-Null
Set-Location '.\.redis-data'
& $redisExecutable --bind 127.0.0.1 --port 6379 --appendonly yes --dir .
```

Expected: `Ready to accept connections`. This path is specific to the Redis installation already present on this machine; it is not a new package dependency or a production deployment recipe.

### Terminal 2 — Python API

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\ai-service"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 api
```

Expected: `Uvicorn running on http://127.0.0.1:8001`. The helper loads `.env` and invokes this project's `.venv` interpreter. No activation or manual Get-Content loop is required. `(.venv)` in another directory does not change the location of relative paths.

### Terminal 3 — Resume worker

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\ai-service"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 worker
```

Expected: Redis connection and worker `ready`, with concurrency two. `.env` must provide `GOOGLE_GEN_API_KEY`, `MONGO_URI`, `REDIS_URL`, `RESUME_STORAGE_DIR` and any database override. Optional `RESUME_MODEL` defaults to `gemini-2.5-flash`. Starting this worker can resume queued processing, including Gemini profile calls on those documents.

### Terminal 4 — Queue recovery scheduler

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\ai-service"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start.ps1 beat
```

Expected: `beat: Starting...`. Keep one instance. It recovers missed queue publication and due retries; it does not perform OCR itself.

### Terminal 5 — Node backend

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\Backend"
npm run dev
```

Expected: successful database connection and backend startup. Restart an existing backend terminal to load the corrected port.

### Terminal 6 — React frontend

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\Frontend"
npm run dev
```

Open the local URL Vite prints. These are six processes, not six installations. The startup helper handles environment loading; it does not combine or duplicate their jobs.

## Quick connection checks

In a spare terminal, while the services are running:

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\Backend"
node scripts/check-ai-health.js
```

Expected: `{"status":"ok","service":"prepwise-ai"}`. Opening `/health` directly in a browser should give 401 because the browser lacks the internal service token; that is correct. Do not put this token in frontend code.

Redis check:

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\ai-service"
.\.venv\Scripts\python.exe -c "from redis import Redis; print(Redis(host='127.0.0.1',port=6379,socket_timeout=3).ping())"
```

Expected: `True`. If API health succeeds but JD extraction fails, check the Python API terminal and Gemini configuration/quota. If resumes stay queued, check Redis, the worker and beat. If profile extraction fails, inspect that resume's error and the worker's Gemini configuration; original extracted text is retained.

## Manual test checklist

Use a fresh analysis and test resumes. Start with 1–10 resumes. Large live profile batches consume Gemini quota; concurrency two is not a guarantee that a free-tier account can process 100 resumes without throttling. Failed files can be retried after the cause is corrected.

| Checkpoint | What to do | Expected result |
| --- | --- | --- |
| 0 — audit | Refer to the architecture report/project context. | Planning checkpoint; no separate UI action. |
| 1 — routing | Log in, select recruiter workspace, open dashboard/new analysis/overview/candidates/chat. Then try a recruiter URL in a signed-out/incognito session. | Authenticated routes open; signed-out access is blocked. Candidate workspace still opens. Placeholder destinations need not implement future ranking/chat yet. |
| 2 — dashboard | Open recruiter dashboard, then create an analysis and return. | New Analysis works; recent analyses/status/counts reflect available data. No fabricated live statistics. |
| 3 — wizard | Move through JD, resumes and results configuration. Select 10 PDFs and choose Top-K 11, then 10, then All candidates. | 11 is blocked; 10 and All candidates are valid. Back/Next retain the draft. |
| 4 — JD text | Paste a real job description of at least 100 characters. Also try empty/very short text. Create an analysis. | Valid original text is saved and shown; invalid content is rejected. The source remains available. |
| 5 — JD PDF | Upload a readable text PDF; also try a non-PDF, a malformed PDF and a file exceeding the UI limit. | Valid PDF text is extracted and original file retained; invalid/oversized files show errors. Scanned-JD OCR is not promised by the resume OCR checkpoint. |
| 6 — JD requirements | Run requirement extraction and review the result against the source. | Structured title/skills/experience/education/etc. appear; missing information stays unspecified. Review confirmation is saved. |
| 7 — service foundation | Run the Node health command above. | Exact PrepWise health response; requests without internal token are rejected. |
| 8 — resume PDFs | Upload one PDF, then ten PDFs. | Every accepted resume appears with its own ID, original filename and UPLOADED status before processing. |
| 9 — folder | Choose a folder containing PDFs plus non-PDF/oversized test files; use 100 valid PDFs for the larger case. | Counts distinguish valid/rejected files; valid PDFs upload in controlled batches. |
| 10 — ZIP | Upload a ZIP of PDFs plus invalid entries. | Accepted PDFs appear individually; rejected entries are reported. Traversal/zip-bomb protection is covered by automated tests—do not create dangerous archives manually. |
| 11 — queue | Click Start processing. Refresh/reopen the analysis while it runs. | Progress advances to completion; each file ends processed, failed or OCR-required. Errors are per-file, with retry controls. A pending provider quota can cause delayed retries/failures. |
| 12 — native extraction | Process a text-based multi-page resume. Open its profile/source after successful processing. | Text and page numbering remain traceable; original PDF is preserved. |
| 13 — OCR | Process a scanned resume and a normal text resume. | Scan shows Text extracted with OCR; normal PDF shows Text extracted directly from PDF. Unreadable/missing-language-data scans stay explicitly OCR_REQUIRED. |
| 14 — profile | On a newly processed resume click View candidate profile. Compare name/contact/skills/jobs/dates/education/projects/certifications/domains/languages to source evidence. Try a resume missing dates/email/phone. | Fields are source-supported; missing fields show unknown. Evidence includes page numbers; parser/model versions are visible. Older successful resumes need a fresh upload/process to obtain profiles. |
| 15 — chunks | Expand Source chunks and Original extracted text. Check job separation and page ranges, including a job spanning pages. | Semantic sections and individual jobs remain meaningful, every chunk has provenance, and source text is retained. Automated tests verify exact reconstruction, including whitespace. |

For checkpoint 14, inspect at least ten test resumes with varied layouts/content rather than only ten copies of one file. Ten synthetic resumes were already manually checked against live Gemini outputs; this does not claim that the user's private stored resumes were externally reviewed.

Also verify the earlier profile UI changes: avatar opens/closes the menu; outside click and Escape close it; Profile opens its own page; saving name/photo shows a toast that disappears after about three seconds; Settings contains theme/logout/delete-account; both themes and small screens remain usable. Test account deletion only on a disposable test account you intend to remove. Log in again after testing logout and confirm the existing candidate workflow still works.

## Automated verification commands

Run these when checking code changes; ordinary tests use isolated fixtures, not production MongoDB/resumes:

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\ai-service"
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\Backend"
npm test
```

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\Frontend"
npm test -- --maxWorkers=1
npm run lint
$env:VITE_API_URL='https://example.com'
npm run build
Remove-Item Env:VITE_API_URL
```

The temporary example.com value only tests the production build; it is not your deployment URL. The current full lint has known baseline errors in Interview.jsx, NewAnalysis.jsx and theme.context.jsx, documented in CHECKPOINT_14_15.md. They are separate from the port problem.

For the isolated 100-PDF Redis/Celery/Mongo integration test (synthetic profile provider; no 100 paid AI calls), use a spare terminal:

```powershell
cd "C:\Users\harsh\OneDrive\Documents\full-stack-web\Backend-Development\full-stack-GenAI\Backend"
$env:CHECKPOINT11_QUEUE_TEST='1'
$env:TEST_REDIS_SERVER=(Resolve-Path '..\ai-service\.test-tools\redis\Redis-8.2.10-Windows-x64-cygwin\redis-server.exe').Path
node --test --test-name-pattern='Checkpoint 11' test/database.test.js
Remove-Item Env:CHECKPOINT11_QUEUE_TEST, Env:TEST_REDIS_SERVER
```

This creates isolated test services on separate ports and tears them down afterward. Requirements-test.txt must already be installed in the Python virtualenv. The real OCR portion also needs English language data (`python scripts/setup_ocr.py`).

## Changes for this startup fix

- `Backend/.env`: only AI_SERVICE_URL changed to localhost:8001; ignored private config, no token changes.
- `Backend/.env.example`: default port aligned to 8001.
- `ai-service/scripts/start.ps1`: environment-loading API/worker/beat launcher, no global policy changes.
- `ai-service/.gitignore`: ignore persistent local Redis data.
- `ai-service/README.md`: corrected current startup/queue instructions.
- `TESTING_THROUGH_CHECKPOINT_15.md`: this guide.

No dependency, database schema, API contract or authentication changes. Verified the new API launcher and Node-to-Python health connection. No production worker/jobs were started during this diagnosis; no private resumes were sent to Gemini. The temporary diagnostic API is stopped after verification so the user's startup command can own port 8001.

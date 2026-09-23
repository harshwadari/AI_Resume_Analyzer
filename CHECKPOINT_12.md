# Checkpoint 12 — Resume text extraction

Implemented and locally verified on 2026-09-22. Scope stops at resume text extraction and explicit OCR-required status. Existing authentication, OAuth, candidate features, JD extraction and queue ownership remain in place.

## Result

The existing Celery worker runs PyMuPDF in the bounded PDF subprocess. Each processed resume stores:

```text
rawText: page strings joined by a form-feed character (\f)
pages: [{ pageNumber: 1, text: "..." }, ...]
documentMetadata: {
  pageCount, format, title, author, subject, keywords,
  creator, producer, creationDate, modDate, trapped
}
parserVersion: "resume-text-v2-pymupdf"
processedAt: completion timestamp
processingStatus: PROCESSED | OCR_REQUIRED | FAILED
```

Page numbers are one-based and consecutive. Empty/image pages stay in the array, so later evidence can refer to the correct original PDF page. `rawText` is derived from the exact page strings; original PDFs are never rewritten. Pydantic checks types, bounds, page order/count, raw-text consistency and outcome before the worker writes extraction data to MongoDB.

Documents without any Unicode letters are marked `OCR_REQUIRED`, including image-only scans, blanks, replacement glyphs, and page-number-only documents. This check detects text presence; it does not judge resume quality. The UI shows the affected filename, an OCR explanation and a separate OCR count. Such documents are terminal for this extraction job, count toward completion, and are excluded from automatic/manual failure retries. No OCR engine, candidate parsing, matching or ranking was added.

## Verification

| Check | Result |
| --- | --- |
| Python unittest suite | 28 passed |
| Backend suite with optional real queue test enabled | 52 passed, zero skipped |
| Frontend Vitest suite | 60 passed |
| Frontend production build | Passed |
| ESLint on changed frontend files | Passed |
| Full frontend lint | Existing 2 errors and 1 warning in untouched interview/theme files |
| Python dependency consistency (`pip check`) | Passed |

The integration test uses real HTTP uploads, FastAPI, Redis 8.2.10, Celery and an isolated MongoDB replica set. It processed 100 PDFs, observed 61 progress snapshots from 0/100 to 100/100, kept maximum active concurrency at two, survived Redis persistence/worker restart checks, and verified individual parser failure and retry. All 100 records have page data, metadata, parser version and completion timestamps.

A further HTTP upload of a three-page text resume and an image-only resume completed as **2/2: 1 extracted, 1 OCR required, 0 failed**. MongoDB assertions verified reading-order text, the blank second page, rotated third page, Unicode text, metadata, and byte-for-byte unchanged originals. The image-only resume remained `OCR_REQUIRED` after a retry-failed request. Separate frontend DOM tests cover the OCR notice and counts; no browser screenshot test was performed.

Parser tests also cover Chinese text, mixed text/image PDFs, blank documents, numeric footers on scans, encrypted PDFs (including empty user passwords), malformed files, renamed non-PDF content, excessive pages, size/text limits, invalid parser output, subprocess timeout cleanup and idempotent terminal outcomes.

The build used a process-only `VITE_API_URL=https://example.com`, because production configuration rejects the saved development HTTP origin. Saved environment files were not changed. The pre-existing bundle-size warning remains. Full lint still reports `react-hooks/set-state-in-effect` and a dependency warning in `Interview.jsx`, plus `react-refresh/only-export-components` in `theme.context.jsx`.

## Dependency, environment, database and API changes

- Python: added/pinned `PyMuPDF==1.28.2`, replacing declared `pypdf==6.19.0`. No new Node, frontend or test dependencies. The requested library was installed in the project's existing virtual environment.
- Environment variables: none added. Existing private storage, MongoDB, Redis and internal-service settings are reused.
- MongoDB Resume schema: added private `pages` and `documentMetadata`; added `OCR_REQUIRED` to `processingStatus`. Existing `rawText`, `processedAt`, `parserVersion` and original storage reference are reused. Extraction fields remain excluded from default queries and paginated resume responses. No new collection or destructive migration.
- Existing authenticated `GET/POST /api/recruiter/analyses/:analysisId/processing` responses add `job.ocrRequired`. `job.completed` includes processed, failed and OCR-required files; a finished job with any failed/OCR-required file uses the existing `COMPLETED_WITH_ERRORS` status. Existing fields remain available.
- Existing resume upload/list serializers can return the new `OCR_REQUIRED` status. No new routes or authentication changes. The protected Python job-publication contract is unchanged.

## Upgrade and practical limits

Install the updated Python requirements and restart the worker before trying newly uploaded resumes. Startup commands are in the [AI service README](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/ai-service/README.md).

Existing v1 processed records keep their original text and have no invented page arrays. This checkpoint does not automatically reprocess existing records; upload a fresh copy and start processing to verify the new format. Mixed PDFs retain empty scanned pages and are `PROCESSED` when other pages contain text. Actual OCR is a later task.

Reading order uses PyMuPDF spatial sorting and can vary for complex columns/tables; it is not a semantic layout parser. Limits remain 5 MiB, 50 pages, 100,000 extracted characters and 35 seconds per subprocess. Metadata strings are bounded to 10,000 characters. Oversized extraction output fails explicitly rather than truncating. Encrypted/unreadable files fail individually. The parser replacement can change whitespace/order compared with v1; the version distinguishes those records.

## Changed files

| File | Change |
| --- | --- |
| [resume_extraction.py](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/ai-service/app/models/resume_extraction.py) | New validated page/document extraction contract |
| [resume_pdf.py](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/ai-service/app/parsers/resume_pdf.py) | PyMuPDF extraction, metadata and OCR detection |
| [processing.py](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/ai-service/app/services/processing.py) | Persist validated output and finish OCR-required jobs |
| [requirements.txt](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/ai-service/requirements.txt) | PyMuPDF dependency replaces pypdf |
| [test_resume_extraction.py](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/ai-service/tests/test_resume_extraction.py) | New parser acceptance and boundary tests |
| [resume_pdf_fixtures.py](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/ai-service/tests/resume_pdf_fixtures.py) | Synthetic text/image PDFs shared by Python and HTTP tests |
| [test_processing.py](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/ai-service/tests/test_processing.py) | Structured output, persistence, invalid output and terminal OCR tests |
| [resume.model.js](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/Backend/src/models/resume.model.js) | Private extraction fields and OCR status |
| [processing.service.js](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/Backend/src/services/processing.service.js) | OCR progress counts and completion semantics |
| [database.test.js](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/Backend/test/database.test.js) | Real queue extraction acceptance and API regression coverage |
| [ProcessingProgress.jsx](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/Frontend/src/features/recruiter/components/ProcessingProgress.jsx) | Extracted/OCR counts and completion notice |
| [ResumeUploads.jsx](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/Frontend/src/features/recruiter/components/ResumeUploads.jsx) | Per-file OCR explanation |
| [processing.test.jsx](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/Frontend/test/processing.test.jsx) | Frontend OCR status/progress test |
| [README.md](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/ai-service/README.md) | Setup, extraction format, behavior and upgrade notes |
| [PROJECT_CONTEXT.md](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/PROJECT_CONTEXT.md) | Saved checkpoint status and scope |
| [CHECKPOINT_12.md](C:/Users/harsh/OneDrive/Documents/full-stack-web/Backend-Development/full-stack-GenAI/CHECKPOINT_12.md) | This implementation and verification report |

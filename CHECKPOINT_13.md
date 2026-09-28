# Checkpoint 13 — OCR fallback

Implemented only resume OCR fallback on the existing asynchronous worker pipeline. Native extraction runs first, per page. Sufficient text bypasses OCR. Nonblank pages with insufficient text use a replaceable provider interface; the initial implementation is local Tesseract through the existing PyMuPDF runtime. Blank pages retain their positions without an OCR call.

OCR output is normalized (Unicode NFC, line endings, control-character removal), validated by Pydantic, and stored with page boundaries and original metadata. Original PDFs remain unchanged. Mixed PDFs combine native and OCR text. Incomplete scans remain explicitly `OCR_REQUIRED`, including mixed documents with unresolved scanned pages.

## Setup and user verification

English language data is already installed in this local workspace at `ai-service/.ocr/tessdata/eng.traineddata`, which is ignored by Git. No extra terminal or running service is required. Restart the existing Celery worker to load the new parser; restart Node if not using its development watcher.

On another machine/deployment, run once from `ai-service`:

```powershell
.venv/Scripts/python scripts/setup_ocr.py
```

The setup script downloads the official English tessdata_fast 4.1.0 model over HTTPS and verifies its pinned SHA-256 before installing. No model downloads occur during resume processing. Defaults work without editing `.env`; Python still requires optional overrides to be present in the worker's process environment.

Upload a normal text resume and a scanned resume to an analysis, then start processing. Both should become `PROCESSED`, showing respectively “Text extracted directly from PDF” and “Text extracted with OCR.” Previous `OCR_REQUIRED` files can be selected with **Retry failed / OCR files**. Existing successfully processed records are not migrated/reprocessed automatically.

## Dependencies and environment

- No new Python or npm dependencies. Existing PyMuPDF supplies the OCR runtime.
- Runtime data: English Tesseract language model, Apache-2.0, approximately 4 MiB. [Official model source](https://github.com/tesseract-ocr/tessdata_fast/tree/4.1.0). [PyMuPDF OCR setup documentation](https://pymupdf.readthedocs.io/en/latest/installation.html#enabling-integrated-ocr-support).
- New optional variables: `OCR_PROVIDER` (default `tesseract`; `disabled` bypasses available providers), `OCR_LANGUAGES` (default `eng`), `OCR_TESSDATA_DIR` (absolute language-data directory). The adapter also honors standard `TESSDATA_PREFIX` if no explicit directory is supplied. Additional languages require their language data.
- No secrets or existing user environment files were changed.

## Database and APIs

- Resume schema adds optional `extractionMethod`, restricted to `text` or `ocr`, and private `ocrRequiredPages` (unresolved one-based page numbers).
- New parser output requires a validated method. `ocr` means at least one page contributed usable OCR text; unsuccessful OCR attempts do not claim successful OCR extraction.
- Parser version becomes `resume-text-v3-ocr`. Existing rawText/pages/metadata remain, with unchanged original-file references.
- Existing resume upload/list/ZIP serializers add `extractionMethod` (`null` for older/unprocessed records). No new endpoints.
- Existing processing POST `{retryFailed: true}` now explicitly selects both `FAILED` and `OCR_REQUIRED`; automatic retries do not loop on unreadable scans. Authorization remains unchanged.
- No migration, authentication/OAuth changes, candidate changes, matching, embeddings, or ranking.

## Verification

- Python: **35 tests passed**, including real OCR through the bounded subprocess and worker persistence, native-path provider bypass, mixed pages, missing engine data, normalization and output limits. The extraction validation suite was rerun after adding invalid-method/page assertions: **9 passed**.
- Backend: **52 tests passed, zero skipped**, including a real Redis 8.2.10 + Celery + isolated MongoDB run. The 100-resume batch progressed from 0/100 to 100/100 with 55 observed progress snapshots and maximum active count two; broker/worker restart and failure/retry checks passed. A separate text/scanned pair finished 2/2, with `text`/`ocr` methods persisted and original bytes unchanged.
- Frontend: **61 tests passed** (`npm test -- --maxWorkers=1`).
- Production frontend build: **passed**, using process-only `VITE_API_URL=https://example.com` because the saved development origin is not a production URL. Existing bundle-size warning remains.
- Changed-file ESLint: **passed**. Full frontend lint remains blocked by baseline errors in `Interview.jsx` (setState in effect), `NewAnalysis.jsx` (unused `Icon` parameter), and `theme.context.jsx` (mixed Fast Refresh exports), plus the existing missing-dependency warning in `Interview.jsx`. These files were not modified by this checkpoint. Backend has no lint/build scripts.
- `git diff --check`: **passed**. Setup script verified already-installed English data successfully.
- All integration data used isolated test storage/databases. No production resumes/accounts were processed or changed. Browser-level visual testing was not performed; the UI changes are labels/messages covered by frontend tests.

## Limits and possible regressions

- OCR takes longer than native extraction. Worker concurrency stays two; the parser timeout increases from 35 to 95 seconds, below the 120-second lease. Unix CPU limit is 90 seconds; rasterization is limited to 16 million pixels per page at 200 DPI. Existing 5 MiB/50-page/100,000-character limits remain.
- Text sufficiency is a heuristic: 12 Unicode letters or five CJK characters, with replacement glyphs limited. Very short text pages may invoke OCR; corrupt but alphabetic text layers may bypass it. This is not an assessment of resume/candidate quality.
- Poor scans, unsupported languages, oversized page rasters or missing data can remain `OCR_REQUIRED`. Long documents may time out and exhaust bounded retries. OCR can misread characters and does not provide semantic layout interpretation.
- A mixed PDF previously marked processed despite empty scanned pages may now correctly remain incomplete until those pages can be read.
- The queue integration harness now drains its old thread executor before a restart. Celery's embedded test helper previously stopped the consumer without waiting for active task threads, creating overlapping workers during the test.

## Changed files

- `Backend/src/controllers/resume.controller.js` — expose extraction method.
- `Backend/src/models/resume.model.js` — extraction method and private unresolved pages.
- `Backend/src/services/processing.service.js` — explicit retry of OCR-required files.
- `Backend/test/database.test.js` — real OCR persistence, native method and retry verification.
- `Frontend/src/features/recruiter/components/ProcessingProgress.jsx` — retry action label.
- `Frontend/src/features/recruiter/components/ResumeUploads.jsx` — method labels and incomplete-OCR guidance.
- `Frontend/test/processing.test.jsx` — OCR UI assertions.
- `ai-service/.env.example` — optional OCR configuration.
- `ai-service/.gitignore` — exclude downloaded language data.
- `ai-service/README.md` — setup, operation and limits.
- `ai-service/app/models/resume_extraction.py` — validated method, unresolved pages and sufficiency check.
- `ai-service/app/parsers/resume_pdf.py` — per-page fallback with source preservation.
- `ai-service/app/services/ocr.py` — provider protocol, local adapter and normalization (new).
- `ai-service/app/services/processing.py` — parser version and bounded OCR timeout.
- `ai-service/scripts/setup_ocr.py` — pinned, checksum-verified one-time setup (new).
- `ai-service/tests/queue_harness.py` — drain worker threads before restart.
- `ai-service/tests/test_ocr.py` — fallback/no-fallback, normalization, limits and real OCR tests (new).
- `ai-service/tests/test_processing.py` — validated extraction-method fixture.
- `ai-service/tests/test_resume_extraction.py` — explicit disabled-provider coverage and output validation.
- `PROJECT_CONTEXT.md` — current checkpoint and verification context.
- `CHECKPOINT_13.md` — this report (new).

Local ignored runtime file added: `ai-service/.ocr/tessdata/eng.traineddata`. Generated frontend build artifacts are ignored.

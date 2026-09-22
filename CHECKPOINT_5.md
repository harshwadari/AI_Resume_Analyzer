# Checkpoint 5 — JD PDF upload and profile toast

## Delivered behavior

The profile save/preview notification disappears after 3 seconds. Each subsequent notification restarts the timer, and leaving the page clears it.

New Analysis now offers pasted JD text or a PDF. PDF uploads accept one file up to 5 MiB, validate its extension, MIME type and PDF signature, and assign a random storage filename. The user-supplied filename is sanitized and used only as display/download metadata. Files are never served statically.

The original is stored privately before text extraction. Extraction runs in an isolated Node worker using the existing pdf-parse dependency, with a 15-second timeout, a 128 MB worker heap limit, and at most 50 pages. Extracted text must satisfy the existing 100–20,000 character JD validation. Successful uploads create a draft analysis; the original PDF and extracted text are preserved. Rejected uploads remove the staged file and create no analysis. Scanned/image-only, unreadable, or password-protected PDFs return a readable error; OCR and AI parsing are not included.

The saved analysis page shows extraction status and offers an authenticated download of the original bytes. Resume selection and Top-K behavior remain unchanged.

## APIs and database

- Added `POST /api/recruiter/analyses/pdf`: multipart field `jd`, exactly one PDF, no extra fields. Existing cookie authentication and CSRF checks apply. Returns 201 with an analysis. Invalid upload returns 400, oversize returns 413, extraction/content failure returns 422.
- Added `GET /api/recruiter/analyses/:analysisId/original`: attachment download for the authenticated owner only; another owner's analysis returns 404.
- Existing analysis GET includes `originalFile: { name, size }` and `extractionStatus` for PDF analyses. Storage paths/keys are not exposed. Existing text-analysis response fields are unchanged.
- Analysis schema: `sourceType` additionally accepts `pdf`; immutable `originalFile: { key, name, size }` and `extractionStatus: completed` are added. `rawJDText` holds extracted text for PDFs and remains immutable. Failures do not create records or a failed status. No migration is required.
- No dependencies added; existing multer/pdf-parse are reused. No authentication logic changed.

## Configuration and limits

- Added `JD_STORAGE_DIR`, documented in `Backend/.env.example`. Set an absolute private persistent-disk directory in production. Uploads return 503 when production storage is unconfigured. All backend instances serving uploads/downloads must share this storage. Back up this disk alongside MongoDB.
- Development defaults to `Backend/.private/jds`, excluded from Git. No public upload directory or Qdrant file storage is introduced.
- Extraction remains a bounded request for a single JD; this is not a resume-batch job queue or Python AI service.
- Existing account deletion still does not remove analysis records (as documented in Checkpoint 4), and now also leaves retained originals inaccessible. Cleanup remains a separate scope; account deletion internals were not changed.
- Retries after an ambiguous response can create another draft; there is no idempotency key. A process crash between file storage and database commit can leave an orphan file; routine retention/reconciliation is not implemented here.

## Verification

- Backend: 44 tests passed, including a real generated PDF through HTTP upload, extraction, MongoDB persistence, byte-identical download, ownership/CSRF/auth checks, immutable originals, malformed PDFs, no-text PDFs, invalid types, missing files, oversize rejection, and failed-upload cleanup.
- Frontend: 50 tests passed, including toast expiry/restart and PDF validation/error/retry/save navigation.
- Changed frontend files pass ESLint.
- Full frontend lint reports existing errors in `Interview.jsx` (state update in effect) and `theme.context.jsx` (mixed Fast Refresh exports), plus an existing hook-dependency warning. These unrelated files were not modified.
- Production build passed, with the existing large-chunk warning (approximately 505 KB).
- No live database, external services, or deployment used for verification.

## Changed files

- `Backend/.env.example`
- `Backend/.private/.gitignore` (new)
- `Backend/src/Routes/recruiter.routes.js`
- `Backend/src/controllers/analysis.controller.js`
- `Backend/src/middlewares/jd-upload.middleware.js` (new)
- `Backend/src/models/analysis.model.js`
- `Backend/src/services/analysis.service.js`
- `Backend/src/services/jd-storage.service.js` (new)
- `Backend/src/services/jd-pdf.worker.js` (new)
- `Backend/test/database.test.js`
- `Backend/test/pdf-fixture.js` (new)
- `Frontend/src/features/recruiter/pages/NewAnalysis.jsx`
- `Frontend/src/features/recruiter/pages/AnalysisOverview.jsx`
- `Frontend/src/features/recruiter/services/analysis.api.js`
- `Frontend/src/features/settings/pages/Profile.jsx`
- `Frontend/test/dashboard.test.jsx`
- `CHECKPOINT_5.md` (new)

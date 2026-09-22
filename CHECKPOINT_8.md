# Checkpoint 8 — Resume single/multiple PDF upload

## Delivered behavior

After saving a JD, select one or multiple resume PDFs in the wizard and click **Upload resumes**. Each uploaded entry shows `UPLOADED`; only pending selections can be removed locally. Top-K continues to count the selected/uploaded entries once each. The saved analysis overview also allows uploads and displays a paginated, refreshable list with original filename, resume ID, status, size, and timestamp. Saved resumes survive navigation and reloads.

Each request accepts 1–10 PDFs, up to 5 MiB each (at most 50 MiB file payload per request). Users can submit further batches. Folders and ZIPs are unsupported. Uploads only store bytes and metadata; there is no synchronous resume parsing, AI call, or batch processing.

## API and storage

- Added `POST /api/recruiter/analyses/:analysisId/resumes`: existing user authentication and CSRF protection, followed by ownership verification before multipart parsing. Multipart field `resumes`, 1–10 files, no extra fields. Returns 201 with `{success, resumes}`.
- Added `GET /api/recruiter/analyses/:analysisId/resumes?page=1`: owner-only, 50 records per page, returning `{success, resumes, total, page, pageSize}`. Missing/other-owner analyses return 404; unauthenticated access returns 401.
- Existing API contracts, authentication, candidate flows, JD text/PDF handling, and Python service are unchanged.
- Validation checks PDF extension, MIME type, `%PDF-` header and `%%EOF` marker. Oversize returns 413; missing files, ZIP/non-PDF, excess file count, and invalid PDF signatures return 400. Full PDF readability/encryption validation belongs to later document processing, so a structurally malformed file with valid boundary markers can still be stored as `UPLOADED`.
- Storage uses generated UUID filenames in a private, non-static directory. Submitted filenames are metadata only, with paths/control characters removed and length capped. Storage references are persisted but never exposed in API responses.
- Metadata writes use a MongoDB transaction that rechecks the verified owner and analysis. A rejected batch creates no resume records. Storage/database failures trigger cleanup of staged originals; cleanup errors produce sanitized server logs.

## Database and configuration

New `Resume` model / `resumes` collection:

- `_id` — resume ID
- `analysis` — immutable analysis ObjectId
- `recruiter` — immutable recruiter ObjectId
- `originalFilename` — immutable filename metadata
- `storageReference` — immutable private storage key, excluded by default from queries/API serialization
- `size` — immutable byte count
- `processingStatus` — enum `UPLOADED`, `PROCESSING`, `PROCESSED`, `FAILED`; default `UPLOADED`
- `createdAt`, `updatedAt` — timestamps

Index: `{recruiter: 1, analysis: 1, createdAt: 1, _id: 1}` for owner/analysis pagination. Existing documents require no migration. Other lifecycle states are reserved for the later processing worker; no endpoint lets clients set them or claims files are processed.

New environment variable: `RESUME_STORAGE_DIR`. Production must set it to a private persistent disk directory shared by all serving instances and included in backups. Without it, resume uploads return 503. Development defaults to `Backend/.private/resumes`, already excluded from Git.

Dependencies added: none.

## Verification

- Backend: 46 tests passed. The new real HTTP acceptance test uploads 1 PDF, then 10 PDFs, and checks 11 unique records and byte-identical private originals. It also tests ownership, CSRF, missing files, ZIPs, invalid signatures, oversize, 11-file rejection, listing, page validation, status validation, and database-failure cleanup.
- Frontend: 53 tests passed. New coverage exercises one then ten uploads, persisted list on navigation/reload, statuses, upload failure, batch limits, and Top-K counting after wizard upload.
- Production build passed; existing large-chunk warning remains (~515 KB).
- Changed frontend files pass ESLint. Full lint retains the existing two errors and one warning in unrelated Interview/theme files.
- `git diff --check` passed.
- Verification used synthetic documents and an isolated MongoDB test database. No live data or deployment was changed.

## Limits and possible regressions

- Production requires the new storage configuration. Uploaded originals need persistent disk retention and backups.
- Uploads are bounded but temporarily held in memory by Multer; proxy/concurrency limits should account for the 50 MiB per-request maximum.
- There is no content deduplication or idempotency key. An ambiguous response may have committed; the UI advises checking/refreshing the saved analysis before retrying. Reuploading a file can create another resume record.
- A process crash between file storage and metadata commit can leave orphan files; periodic reconciliation is not implemented.
- Existing account deletion internals were intentionally preserved. As with earlier analyses/JD originals, resume records/files become inaccessible after account deletion but are not automatically purged. A separately scoped cleanup extension is still needed for complete data removal.
- Original download/removal, parsing, async workers, folder/ZIP upload, matching, and ranking are outside this checkpoint.

## Changed files

- `Backend/.env.example`
- `Backend/src/Routes/recruiter.routes.js`
- `Backend/src/controllers/resume.controller.js` (new)
- `Backend/src/middlewares/resume-upload.middleware.js` (new)
- `Backend/src/models/resume.model.js` (new)
- `Backend/src/services/resume-storage.service.js` (new)
- `Backend/src/services/resume.service.js` (new)
- `Backend/test/database.test.js`
- `Frontend/src/features/recruiter/components/ResumeUploads.jsx` (new)
- `Frontend/src/features/recruiter/pages/AnalysisOverview.jsx`
- `Frontend/src/features/recruiter/pages/NewAnalysis.jsx`
- `Frontend/src/features/recruiter/services/analysis.api.js`
- `Frontend/src/features/recruiter/state/analysisDraft.js`
- `Frontend/test/dashboard.test.jsx`
- `PROJECT_CONTEXT.md`
- `CHECKPOINT_8.md` (new)

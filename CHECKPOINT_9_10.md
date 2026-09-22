# Checkpoints 9 and 10 — Folder and ZIP resume ingestion

## Delivered behavior

The JD PDF picker now uses the same dashed glass panel, icon, purple file-selection button, spacing, and focus styling as the candidate resume picker.

Both the analysis wizard's Candidate Resumes step and the saved analysis page offer **Choose resume folder** and **Choose resume ZIP**. Folder selection reports total files, valid PDFs, rejected files/reasons, queued files and uploaded count. The browser inspects only the first 5 bytes and final 1,024 bytes of each PDF, sequentially; it retains File references rather than whole-file buffers. Valid PDFs upload through the existing endpoint in sequential batches of 10. Confirmed batches are removed from the local queue; a failed batch stops further requests. Already-saved batches remain stored.

ZIP upload streams the archive to a private temporary directory. The server reads entries one at a time, writes accepted candidates under generated UUID names, validates content signatures and CRC, then copies valid PDFs into existing private resume storage and transactionally creates individual `UPLOADED` records. Invalid entries are reported. Temporary originals and extracted files are removed on normal success and handled failure. These are pending resume-processing records, not a new background-worker/job system; no parsing, matching, or ranking starts.

## Limits and protections

- Folder selection: at most 500 files, including rejected files. Individual PDFs remain limited to 5 MiB. Batches contain at most 10 PDFs; one request at a time.
- ZIP: at most 50 MiB compressed, 500 central-directory entries (including folders), 100 MiB total declared expanded bytes, 5 MiB per accepted PDF, and 100:1 per-entry compression ratio. Extraction is bounded to 45 seconds and actual streamed bytes are independently counted.
- Archive signatures are inspected; names/extensions alone never determine acceptance. PDF headers/end markers and ZIP CRC checks are required.
- Absolute/traversal paths, backslashes, drive/ADS syntax, control characters, and ambiguous trailing dot/space paths reject the archive. Archive paths are never used as extraction destinations.
- Symbolic links/special files, encrypted entries, unsupported compression/types, damaged/invalid PDFs, oversized PDFs, and duplicate normalized archive paths are rejected with per-file reasons. Duplicate basenames under different folders receive different UUID storage references and resume IDs, so they cannot overwrite one another.
- ZIP bombs, excessive file counts, unsafe paths and malformed archives reject the whole archive before any resume record is committed. Unsupported/invalid ordinary files are reported while valid files can be imported.
- Filesystem cleanup resolves and checks its target against the dedicated temporary root before recursive removal.
- Existing cookie authentication, CSRF checks and owner authorization apply before archive reception. Private storage and ownership are rechecked during persistence.

Validation is format screening rather than a full semantic PDF parse. A damaged PDF with valid boundary markers and a matching CRC can still be stored for later parsing. OCR, encryption inside PDFs, and detailed PDF readability checks remain part of future processing.

## API, dependencies, configuration and data

- Added `POST /api/recruiter/analyses/:analysisId/resumes/zip`, multipart field `archive`. Returns 201 with `{success, totalFiles, validPDFs, rejected: [{name, reason}], resumes}`. All-invalid ordinary files return an empty resume list with rejection details. Unsafe/malformed archives return 400; archive upload above 50 MiB returns 413.
- Folder uploads reuse the existing resume POST endpoint and limits. The paginated resume GET endpoint and existing API contracts are unchanged.
- Added production dependency `yauzl@3.4.0`, pinned, for lazy ZIP entry reading and decompression size validation. It was previously only a transitive test dependency. The package manifest is updated; the locally updated package lock remains ignored by the repository's existing rules. The native CRC implementation is used where available, with the pinned yauzl CRC fallback otherwise.
- No new environment variables or database schemas. Uses existing `RESUME_STORAGE_DIR` and the existing Resume status/ownership model.
- Temporary archives use the OS temporary directory under `prepwise-resume-imports/zip-*`; originals are retained only as individual resume PDFs in private persistent storage.
- Node remains the main product API. No candidate/authentication internals or Python service behavior changed.

Implementation follows [yauzl's documented lazy-entry and size-validation APIs](https://github.com/thejoshwolfe/yauzl/blob/master/README.md), with application-specific expansion/path/content limits applied separately.

## Verification

- Frontend: 56 tests passed, including 100 valid PDFs discovered, small slice sizes, ten sequential upload batches, rejected file counts, stop-on-failure behavior, and ZIP result reporting.
- Backend: 50 tests passed. The 100-PDF ZIP HTTP ingestion test verified individual `UPLOADED` records and both pages of the resume listing; tests cover archive size rejection, temporary cleanup, invalid file reports, traversal/absolute paths, compression bomb, huge entry count, duplicate paths/basenames, encryption, symlinks, and CRC mismatch.
- Production build passed, with the existing large-chunk warning (~521 KB).
- Changed-file ESLint passed. Full lint retains the same unrelated Interview/theme errors and warning.
- `git diff --check` passed. All fixtures and credentials are synthetic; no live deployment or data was used.

## Known limits

- Folder picker support depends on browser directory-selection support. Individual PDF and ZIP selection remain alternatives. Queues are page-local; leaving loses unuploaded selections. Completed uploads persist.
- The UI disables wizard navigation while an import is active. Leaving the page aborts browser requests; an in-flight server request may already have committed. Check the saved analysis before retrying an ambiguous failure, since content deduplication/idempotency is not implemented.
- ZIP ingestion is bounded streaming I/O in one request, not asynchronous resume processing. Larger datasets must be split within the stated limits. There is no unbounded thousands-file request.
- A process crash can leave temporary/orphan files; scheduled cleanup/reconciliation is not part of these checkpoints. Existing account-deletion retention limitations still apply.

## Files changed for these checkpoints

- `Backend/package.json`
- `Backend/package-lock.json` (local, already ignored)
- `Backend/src/Routes/recruiter.routes.js`
- `Backend/src/controllers/resume.controller.js`
- `Backend/src/middlewares/resume-zip.middleware.js` (new)
- `Backend/src/services/resume-zip.service.js` (new)
- `Backend/src/services/resume-storage.service.js`
- `Backend/src/services/resume.service.js`
- `Backend/test/database.test.js`
- `Backend/test/resume-zip.test.js` (new)
- `Backend/test/zip-fixture.js` (new)
- `Frontend/src/features/recruiter/components/BulkResumeImport.jsx` (new)
- `Frontend/src/features/recruiter/components/ResumeUploads.jsx`
- `Frontend/src/features/recruiter/pages/NewAnalysis.jsx`
- `Frontend/src/features/recruiter/services/analysis.api.js`
- `Frontend/src/features/recruiter/state/analysisDraft.js`
- `Frontend/src/features/recruiter/utils/folderFiles.js` (new)
- `Frontend/test/dashboard.test.jsx`
- `Frontend/test/folder-files.test.js` (new)
- `PROJECT_CONTEXT.md`
- `CHECKPOINT_9_10.md` (new)

Earlier Checkpoint 8 changes remain in the working tree and are documented separately.

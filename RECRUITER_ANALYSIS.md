# Checkpoint 4: JD text analysis creation

## Behavior

The New Candidate Analysis wizard validates and previews pasted text, then uses **Save JD & continue** to create a MongoDB analysis. It accepts 100–20,000 JavaScript string characters; the minimum uses trimmed length only for validation. The stored value is the exact submitted string, including leading/trailing whitespace and line breaks. The UI does not truncate oversized pastes: it reports the error and prevents saving.

After saving, the original is read-only and a link opens the owner-only saved JD page. A different JD requires a new analysis. Resume selection and result configuration remain local previews; no documents are uploaded or parsed and no processing or ranking is started.

Top-K must be a positive safe integer no greater than the known count of selected PDFs, including after removing files. Equality is valid. With zero selected PDFs, choose All candidates or add PDFs. All candidates remains valid. Invalid Top-K blocks Continue and direct navigation to Start analysis.

## API contract

- `POST /api/recruiter/analyses`: existing cookie authentication and CSRF/origin rules. JSON body: `{ "rawJDText": "..." }`. Additional fields are rejected. Recruiter ownership, source type and status are set by the server. Returns HTTP 201 with `{ success: true, analysis: { id, recruiter, rawJDText, sourceType: "text", status: "draft", createdAt } }`.
- `GET /api/recruiter/analyses/:analysisId`: returns the same analysis shape for its authenticated owner. Invalid, missing and other-owner IDs return 404. Unauthenticated/deleted-user access returns 401.
- Invalid JD returns 400. Recruiter JSON requests above 128 KB return 413. The dedicated allowance accommodates Unicode and JSON-escaped content; existing API JSON limits remain 32 KB.
- No update, replacement, processing, resume-upload or parsing endpoints were added.

## Database

New Mongoose model `Analysis`, collection `analyses`: `_id` (analysis ID), `recruiter` (user ObjectId), `rawJDText`, `sourceType`, `status`, `createdAt`, `updatedAt`. The original text, source type and recruiter fields are immutable through normal Mongoose updates. Full-document replacement operations are rejected. Future extracted/normalized content must use separate fields rather than overwriting `rawJDText`.

Creation uses the existing transaction convention and verifies the owner still exists and is verified. It requires a MongoDB replica set, as existing account/report transactions already do. No migration or new custom index is needed for ID-based reads. No existing schema, authentication contract, dependencies or environment configuration changed.

## Current boundaries

- Existing account deletion was not modified, per the global rule. It does **not** remove the new analysis records. Such records become inaccessible after owner deletion but remain stored. A separately authorized cleanup extension is required before deploying this feature with complete account-data deletion.
- Saved-analysis history on the dashboard is not connected yet. Use the saved-original link/URL or authenticated GET endpoint to reopen the original.
- Save controls prevent overlapping submissions in one page, but there is no server idempotency key. A retry after an ambiguous network failure can create another draft; neither draft overwrites the original.
- Only synthetic, isolated MongoDB test data was used during verification; no live database migration or deployment was performed.

## Files changed in this checkpoint

Backend:
- `Backend/src/app.js`
- `Backend/src/Routes/recruiter.routes.js` (new)
- `Backend/src/controllers/analysis.controller.js` (new)
- `Backend/src/models/analysis.model.js` (new)
- `Backend/src/services/analysis.service.js` (new)
- `Backend/src/validations/analysis.validations.js` (new)
- `Backend/test/database.test.js`

Frontend:
- `Frontend/src/app.routes.jsx`
- `Frontend/src/features/dashboard/pages/Recruiter.jsx` (update obsolete creation messaging)
- `Frontend/src/features/recruiter/pages/NewAnalysis.jsx`
- `Frontend/src/features/recruiter/pages/AnalysisOverview.jsx` (new)
- `Frontend/src/features/recruiter/state/analysisDraft.js`
- `Frontend/src/features/recruiter/services/analysis.api.js` (new)
- `Frontend/src/features/recruiter/utils/jdValidation.js` (new)
- `Frontend/test/dashboard.test.jsx`
- `Frontend/test/analysis-draft.test.js`

Documentation: `RECRUITER_ANALYSIS.md` (this file).

Verification commands: backend `npm test`; frontend `npm test -- --maxWorkers=1`, targeted ESLint, and `npm run build` with command-only `VITE_API_URL=/` for the existing production same-origin setup.

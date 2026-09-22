# Checkpoint 6 — JD requirement extraction

> Checkpoint 7 reorganized `AIService` into `ai-service/app`. The current launch target is `app.main:app`; see `ai-service/README.md`. The setup commands and file paths below record the earlier checkpoint.

## Workflow

Save a pasted or PDF JD, then select **Extract requirements** in the wizard or saved analysis overview. The Node API loads the immutable stored JD and sends only its text to a separate private FastAPI service. Gemini receives a structured JSON schema and instructions to extract only explicit requirements, preserving required/preferred distinctions and leaving missing scalar values null and missing lists empty.

Pydantic strictly validates JSON in Python; Zod independently validates the complete service result in Node before persistence. Mongoose also validates the structured JD on document save. Extra fields, omitted fields, string/boolean experience values, invalid ranges, malformed/markdown JSON, oversized lists, blank strings, and invalid metadata are rejected. No raw LLM response is saved or logged. The original JD and original PDF remain unchanged.

The recruiter sees all eleven fields alongside access to the source JD, plus extraction metadata, and can select **Mark requirements reviewed**. Review status persists on reload. This is acknowledgement, not an editor or a hiring decision. No matching starts in this checkpoint; a future matching endpoint must require the persisted review timestamp.

Existing successful extraction is reused. Same-process overlapping requests share a promise; concurrent backend instances may make duplicate model calls, but the transaction preserves the first committed extraction. Failures save no requirements and can be retried. No automatic retries incur extra model calls.

## Architecture and setup

The React/Express/MongoDB application retains authentication, ownership checks, CSRF protection, and database access. The Python service has no database access and no new user authentication system. Its shared credential authenticates backend-to-service calls only. Candidate AI integration is unchanged.

Python 3.12 was used for verification. From `AIService`:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
# Set these in the process environment / deployment secret manager:
$env:AI_SERVICE_TOKEN = '<random shared secret of at least 32 characters>'
$env:GOOGLE_GEN_API_KEY = '<your Gemini API key>'
$env:JD_MODEL = 'gemini-2.5-flash'
.venv/Scripts/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Set `AI_SERVICE_URL=http://127.0.0.1:8000` and the identical `AI_SERVICE_TOKEN` in the backend environment, then restart the backend. The Python `.env.example` is a configuration reference; `.env` files are not automatically loaded. In deployment, run the AI service on private networking and use HTTPS when crossing untrusted networks; do not expose it directly to browsers. Neither secret belongs in frontend/VITE variables. Use deployment-managed credentials instead of committing them.

Dependencies added only for the Python service: `fastapi==0.128.0`, `pydantic==2.12.5`, `httpx==0.28.1`, `uvicorn==0.40.0`. These versions were already available locally; no Node dependencies changed. Tests use Python's built-in unittest.

Environment additions: backend `AI_SERVICE_URL`, shared `AI_SERVICE_TOKEN`; Python `AI_SERVICE_TOKEN`, `JD_MODEL` (default `gemini-2.5-flash`) and the existing application credential name `GOOGLE_GEN_API_KEY`, separately supplied to the new process. Missing service/model configuration fails clearly without interrupting JD saving or candidate workflows. Provider timeout is 45 seconds; backend timeout is 55 seconds.

Gemini schema mode follows the [official structured-output documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en). Schema validation verifies structure and ranges; it does not prove factual extraction accuracy. Recruiter review is still necessary.

## API and data changes

- `POST /api/recruiter/analyses/:analysisId/requirements/extract`, JSON `{}`: owner-only; extracts from the stored JD, returns the serialized analysis. Clients cannot submit raw or structured replacements. Existing extraction returns unchanged without another AI request. Unconfigured service returns 503; invalid/unavailable upstream results return 502; timeout can return 504.
- `POST /api/recruiter/analyses/:analysisId/requirements/review`, JSON `{}`: owner-only; requires an extraction, otherwise 409; returns the analysis with review timestamp. Repeat review preserves the recorded timestamp.
- Existing analysis GET includes extraction/review fields when available. Existing fields and routes are unchanged.
- Internal `POST /v1/jd/extract` accepts `{rawJDText}` plus `X-AI-Service-Token`. Returns `{structuredJD, parserVersion, modelName, extractedAt}` only after validation. Provider errors are sanitized.

Analysis model additions: `structuredJD`, `parserVersion`, `modelName`, `extractedAt` (Date), `requirementsReviewedAt` (Date). No migration is required; existing drafts can be extracted on demand. `rawJDText` remains immutable.

`structuredJD` has exactly: `title`, `requiredSkills`, `preferredSkills`, `minimumExperience`, `maximumExperience`, `education`, `certifications`, `responsibilities`, `domain`, `location`, `employmentType`. Skill/education/certification/responsibility fields are arrays of strings (up to 50 items, each 1–500 nonblank characters). Experience is numeric years, 0–100 or null, with minimum no greater than maximum. Other values are strings or null. Parser version is currently `jd-v1`.

## Verification and limits

- 51 frontend tests passed, including extraction failure/retry, all-field preview, unknown values, zero years, and marking reviewed.
- 45 backend tests passed, including synthetic HTTP AI responses, validation-before-write, ownership, input injection rejection, original preservation, metadata storage, extraction reuse, and persisted review.
- 5 Python tests passed, covering service authorization, request/output validation, malformed JSON, wrong types, ranges, timeout/config errors, Gemini request schema, and metadata.
- Production build passed with the existing large-chunk warning (~509 KB).
- Changed-file ESLint passed. Full lint retains the existing two errors and one warning in the unrelated Interview and theme files.
- Live Gemini output/accuracy was not tested; provider responses are synthetic and isolated, with no production database changes or deployment.
- Extraction quality depends on the model and source text. Review/editing and re-extraction version history are not included. Existing account-deletion retention limitations from prior checkpoints still apply.
- No resume parsing, matching, ranking, Qdrant, Redis, or batch workers were introduced.

## Files changed for this checkpoint

- `AIService/.gitignore` (new)
- `AIService/.env.example` (new)
- `AIService/requirements.txt` (new)
- `AIService/app.py` (new)
- `AIService/tests/requirements.json` (new)
- `AIService/tests/test_app.py` (new)
- `Backend/.env.example`
- `Backend/src/Routes/recruiter.routes.js`
- `Backend/src/controllers/analysis.controller.js`
- `Backend/src/models/analysis.model.js`
- `Backend/src/services/analysis.service.js`
- `Backend/src/services/jd-ai.service.js` (new)
- `Backend/src/validations/jd-requirements.validations.js` (new)
- `Backend/test/database.test.js`
- `Frontend/src/features/recruiter/components/RequirementsReview.jsx` (new)
- `Frontend/src/features/recruiter/pages/AnalysisOverview.jsx`
- `Frontend/src/features/recruiter/pages/NewAnalysis.jsx`
- `Frontend/src/features/recruiter/services/analysis.api.js`
- `Frontend/test/dashboard.test.jsx`
- `PROJECT_CONTEXT.md`
- `CHECKPOINT_6.md` (new)

Prior Checkpoint 5 work remains in the working tree and is listed separately in `CHECKPOINT_5.md`.

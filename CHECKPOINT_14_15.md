# Checkpoints 14–15 — Candidate profiles and semantic chunks

Implemented both checkpoints requested together. The existing React/Express/MongoDB application and Celery queue remain in place. No matching, embeddings, ranking or later roadmap features were added.

## Behavior

Newly processed resume PDFs follow: native text/OCR → strict candidate extraction → grounded evidence validation → lossless section chunks → one guarded MongoDB update for profile and chunks. Original extracted text is saved before the model stage, so a provider failure does not discard it. Original PDFs are never modified. OCR-required documents skip profile extraction.

The candidate profile contains every requested field. Missing scalar values are null and missing lists are empty, displayed as unknown/not stated. Experience entries include company, title, original date strings, a verbatim description, skills and evidence `{pageNumber, text}`. Education includes institution/qualification/dates/evidence; projects include name/description/skills/evidence. `totalExperience` is an explicit quoted duration with units, not a fabricated numeric total or calculation across overlapping jobs.

Gemini receives numbered pages as untrusted document content and returns structured JSON. Pydantic enforces all types, bounds and required fields locally, followed by source-grounding checks. Unsupported scalar/list strings or evidence on the wrong page reject the result rather than entering MongoDB. The provider-side schema retains field/type/required structure but omits size bounds that Gemini's constrained decoder cannot serve; full local limits remain enforced. Parser/model versions and timestamp are stored.

Chunks use semantic heading boundaries and validated individual entry evidence anchors. Recognized sections include summary, skills, experience, individual job experiences, projects, education, certifications and languages. Other/contact/unrecognized content is retained as `other`. Section headings stay with their first entry. No fixed-size splitting is used. Each chunk contains all requested metadata plus exact source offsets. Ordering by chunkIndex and joining text reproduces rawText character-for-character, including whitespace and page separators. This reconstructs the extracted text, not the PDF's visual layout.

After processing, use **View candidate profile** on the analysis resume list to inspect all fields, evidence, source chunks and original extracted text. Existing processed resumes are not automatically migrated; upload/process a fresh copy to generate a profile. Candidate identity is document-scoped: `candidateId = resumeId` within its analysis, not cross-resume person deduplication.

## Manual review of ten resumes

Reviewed ten fictional resume texts against actual **gemini-2.5-flash** outputs, field-by-field and chunk-by-chunk. The API returned modelVersion `gemini-2.5-flash`; that exact returned value is stored, without inventing a more specific version. Inputs are saved in `ai-service/tests/review_resumes.py`; reviewed profiles/pages/model versions are saved in `ai-service/tests/fixtures/candidate_review.json`. These are synthetic, not user/candidate records. Cached full review outputs are in ignored `ai-service/.review/synthetic/01.json` through `10.json`. Changes remain uncommitted for user review.

| Case | Manual observations | Final chunks |
| --- | --- | --- |
| 01 Avery | Stated 5-year experience preserved; email/location retained; phone null; Docker not assigned to the job lacking Docker evidence. | 6 |
| 02 Blair | Graduate with projects/education; no invented jobs, dates of employment, contact details or total experience. | 5 |
| 03 Casey | Two jobs remain separate; Java belongs to the first job, SQL to the second; Present is preserved. | 4 |
| 04 Drew | One job spans pages 1–2 with two correct evidence excerpts; its chunk spans both pages; project/certificate remain separate. | 5 |
| 05 Emery | Remote location retained; inline Summary/Skills headings recognized; missing education dates remain null. | 5 |
| 06 François | Accented name/location and explicitly stated French/English retained; no missing contact information invented. | 4 |
| 07 Gray | Overlapping part-time jobs remain separate; totalExperience remains null rather than double-counting dates. | 5 |
| 08 Harper | Certification and explicit domain retained; domain text is separated from the certification chunk as other. | 5 |
| 09 Indigo | Employment dates remain null; Excel assigned to job evidence, SQL assigned to project evidence. | 5 |
| 10 Jules | Embedded instruction to claim Kubernetes was ignored; skills remain Rust/Linux. Original instruction text stays in an other chunk for faithful reconstruction. | 6 |

All ten profiles passed grounding validation; all ten chunk sets exactly reconstruct the source. Initial inspection found standalone heading chunks; these were merged with their first entries and all ten cached outputs regenerated and checked. Live review encountered a temporary Gemini free-tier rate limit, then completed after the specified delay. Worker handling now honors numeric Retry-After (60–300 seconds) instead of immediately repeating rate-limited calls.

Automatic approval review rejected sending stored private resumes to Gemini without explicit permission. No stored private resumes were sent. The review was completed using the ten fictional fixtures as a safer alternative. Review of the user's actual stored resumes remains optional and requires that permission.

## Verification

- Python: **45 tests passed**. Covers strict/grounded profiles, model schema/version, provider quota handling and durable retry scheduling, raw-text preservation, atomic profile/chunk persistence, OCR bypass, multi-page evidence, lossless chunks, and all ten manually reviewed live outputs.
- Backend: **53 tests passed, zero skipped**, including owner-only detail access and field privacy. Real Redis 8.2.10/Celery/isolated MongoDB test passed 100 PDFs, 60 progress snapshots from 0/100 to 100/100, maximum concurrency two, broker/worker restarts, retries, and real scanned-PDF OCR. Queue tests use an explicitly injected offline profile provider, not 100 paid Gemini calls; they verify profile/chunk persistence and identity metadata through MongoDB. Later rate-limit scheduling and final chunk refinements were verified by focused Python tests.
- Frontend: **63 tests passed**, including profile disclosure, unknowns, evidence/pages/model version, failure display and abort-on-unmount.
- Production frontend build: **passed** with process-only `VITE_API_URL=https://example.com` (saved local dev URL is not a production origin). Existing bundle-size warning remains.
- Changed-file ESLint: **passed**. Full lint still reports baseline errors in `Interview.jsx` (setState in effect), `NewAnalysis.jsx` (unused Icon argument) and `theme.context.jsx` (mixed Fast Refresh exports), plus the existing Interview effect dependency warning. No unrelated lint fixes were made.
- `git diff --check`: **passed**. Backend has no lint/build script. UI validation is component-test based; no browser visual pass was performed.

## Setup, schemas and APIs

- New optional environment variable: `RESUME_MODEL=gemini-2.5-flash`. Existing `GOOGLE_GEN_API_KEY` is now needed by the **Celery worker** for profiles, not just the API's JD extraction. Python still reads process environment, not `.env` automatically. No user secrets were changed.
- Restart the existing Celery worker after configuring its environment. Node development watcher loads the new route/schema; otherwise restart Node. No new terminal, dependency, queue or framework.
- No added npm/Python dependencies. Gemini calls use existing httpx and the existing configured Google account; they consume its quota/billing allowance.
- Resume document adds private embedded `candidateProfile`, private `resumeChunks`, `profileParserVersion`, `profileModel`, `profileModelVersion`, `profileExtractedAt`, `chunkerVersion`, and private `sourceTextHash`. Existing source fields and parser version remain. No new MongoDB collection, index or migration is required; existing account deletion removes the embedded data with resumes.
- New authenticated endpoint: `GET /api/recruiter/analyses/:analysisId/resumes/:resumeId`. Both analysis and resume ownership are checked. Returns profile/chunks/source/pages/versions; private storage references remain hidden.
- Existing upload/list/ZIP serializers add `hasProfile`. Full profiles/chunks remain excluded from ordinary queries and paginated lists. Existing API fields and authentication are preserved.
- Worker concurrency remains two. Native/OCR deadline stays 95 seconds, model stage adds a 65-second deadline, lease is 240 seconds, Redis visibility is 300 seconds. Document attempts remain capped at three. Invalid/ungrounded model output is retried and eventually reported as a per-file failure, with original text retained.

## Limits and possible regressions

- Processing now depends on Gemini availability/quota and takes longer. Missing configuration or sustained quota exhaustion can fail profile processing; retry after correcting the cause. It does not falsely mark a text-only result as a complete structured profile.
- Grounding prevents values absent from the source and catches wrong evidence pages; it cannot prove the model interpreted every source statement correctly or extracted every fact. Recruiter review remains necessary. No hiring decision is automated.
- Heading recognition covers common English variants and validated entry evidence. Unrecognized layouts/languages may produce broad other chunks. Large coherent sections are intentionally not arbitrarily sliced; future embedding token limits need a separate section-aware subdivision phase.
- Page provenance addresses extracted PDF page text. It does not provide bounding boxes or guarantee visual reading order on complex multi-column PDFs. OCR errors can propagate into source-grounded fields.
- No automatic reprocessing of existing successful resumes or cross-analysis deduplication is performed.

## Changed files

Backend:
- `Backend/src/Routes/recruiter.routes.js` — owner-protected detail route.
- `Backend/src/controllers/resume.controller.js` — detail handler and hasProfile flag.
- `Backend/src/models/candidateProfile.schema.js` — embedded profile/chunk schemas (new).
- `Backend/src/models/resume.model.js` — profile, chunk and version fields.
- `Backend/src/services/resume.service.js` — owner-scoped detail retrieval.
- `Backend/test/database.test.js` — detail privacy and queue persistence assertions.

Frontend:
- `Frontend/src/features/recruiter/components/ResumeProfile.jsx` — compact review viewer (new).
- `Frontend/src/features/recruiter/components/ResumeUploads.jsx` — viewer integration and processing copy.
- `Frontend/src/features/recruiter/services/analysis.api.js` — detail client.
- `Frontend/test/processing.test.jsx` — updated service mock.
- `Frontend/test/resume-profile.test.jsx` — viewer tests (new).

Python/configuration/tests:
- `ai-service/.env.example` — resume model setting.
- `ai-service/.gitignore` — private review output exclusion.
- `ai-service/README.md` — setup, contracts and limits.
- `ai-service/app/core/celery_app.py` — visibility timeout.
- `ai-service/app/models/candidate.py` — strict schema and grounding (new).
- `ai-service/app/services/candidate.py` — replaceable provider interface, Gemini adapter, validated extraction (new).
- `ai-service/app/services/resume_chunks.py` — lossless semantic chunking (new).
- `ai-service/app/services/processing.py` — worker integration, lease and quota retry handling.
- `ai-service/scripts/review_candidates.py` — explicit local live review utility (new).
- `ai-service/tests/candidate_fixtures.py` — offline test provider (new).
- `ai-service/tests/fixtures/candidate_review.json` — ten manually reviewed synthetic live-model outputs (new).
- `ai-service/tests/queue_harness.py` — explicit test provider injection.
- `ai-service/tests/review_resumes.py` — ten fictional source resumes (new).
- `ai-service/tests/test_candidate.py` — validation/chunking/provider/worker review tests (new).
- `ai-service/tests/test_processing.py` — isolate model calls in existing worker tests.

Project documentation:
- `PROJECT_CONTEXT.md` — updated checkpoint context.
- `CHECKPOINT_14_15.md` — this report (new).

Ignored generated artifacts: synthetic live review JSON under `ai-service/.review/synthetic` and frontend production build output. No production MongoDB records or stored PDF bytes were changed during verification.

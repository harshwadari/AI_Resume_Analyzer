# Saved project context

Saved on 2026-09-21 from the user's architecture message and attached recruiter workflow. This is planned direction, not a claim that these features are implemented.

## Working agreement

- The user will provide tasks phase by phase.
- Implement only the requested phase/task, then run appropriate checks and explain the result.
- The user verifies each increment before authorizing the next implementation.
- Do not build the complete architecture at once or advance through phases automatically.
- Current checkpoint: Checkpoint 12 is implemented and locally verified. PyMuPDF extracts resume `rawText`, numbered `pages` (including blank pages), and document metadata through the existing bounded Celery worker. Image-only/no-usable-text PDFs terminate as `OCR_REQUIRED`, with a separate frontend/progress count; OCR itself is not implemented. A real Redis 8.2.10/Celery/MongoDB test passed 100 resumes, restarts, retries, and a text/image extraction batch with original bytes preserved. Backend 52 tests, Python 28 tests, frontend 60 tests, production build and changed-file lint pass; unrelated baseline lint errors remain. See `CHECKPOINT_12.md` for all files, contracts, verification and limitations. Python setup is in `ai-service/README.md`; install the updated requirements and restart the worker. Existing v1 processed records are retained without a migration; newly processed uploads receive page data. Wait for user verification and an explicit next-checkpoint request.

## Product direction

The recruiter product centers on an **Analysis**: provide a job description and resumes, optionally choose a number of top candidates, then receive ranked candidates with supporting evidence.

Do not make job creation or a persistent candidate database the primary flow. Persistent job management can come later.

## Recruiter workflow

1. Recruiter dashboard offers **New Candidate Search** and recent analyses with processing status, resume counts, requested Top-K, and results links.
2. Create an analysis using pasted JD text or an uploaded JD PDF.
3. Extract and show structured JD requirements for recruiter review before matching: required skills, preferred skills, experience, responsibilities, and education where applicable.
4. Accept resumes through single/multiple PDFs, folder selection, or ZIP upload. Add these input modes incrementally. Folder selection collects PDFs; ZIP processing requires secure extraction, file validation, size limits, path traversal protection, and unsupported-file handling.
5. Process resumes into text, structured candidate information, and searchable representations. Show meaningful progress and counts for large batches, not just a spinner. Use background processing for 1,000+ resumes instead of one long HTTP request.
6. Offer either all candidates ranked or an optional Top-K count (for example 5, 10, 20, or 50). Top-K controls returned results after analysis/ranking, not the number of resumes accepted for processing.
7. Match JD requirements against resumes through candidate retrieval, hybrid search, reranking, Top-K selection when requested, and evidence extraction.
8. Results show ranked candidates, match strength, skills, experience, evidence summaries, gaps/uncertainty, search, and filters. Display the analyzed count and shown count accurately.
9. Candidate details show the resume, requirement-level match analysis, and actual supporting resume excerpts. Distinguish evidence not found from a demonstrated lack of skill. Planned review actions include shortlist, reject/continue, and contact.
10. Recruiters review evidence and make the final candidate decisions.

## Architecture

Keep the existing React frontend, Node/Express backend, and MongoDB as the main product. Existing authentication and recruiter/candidate APIs remain in that application. Node's analysis service coordinates with a separate Python/FastAPI AI service.

The Python service handles document processing/parsing, embeddings, retrieval, reranking, RAG, and evidence generation. Heavy processing runs asynchronously with workers; Celery with Redis is the proposed approach.

Qdrant is the chosen retrieval layer, with planned dense + sparse hybrid retrieval, payload filtering, reciprocal rank fusion (RRF), and multi-stage/late-interaction reranking where needed.

Keep embedding providers behind an abstraction. The user's proposed options are Gemini Embedding 2 (configurable dimensions) and BGE-M3 (dense, sparse, and ColBERT-style representations). `BAAI/bge-reranker-v2-m3` is the proposed multilingual reranker, separate from the embedding model. These are saved proposals; verify availability, API details, compatibility, and resource requirements when their implementation phase is requested.

### Data ownership

**MongoDB:** users, recruiters, analyses, jobs/JDs, resume metadata, parsed candidate data, ranking configurations, results, chat history, and processing status.

**Qdrant:** resume/JD/evidence chunks, dense vectors, sparse vectors, late-interaction vectors where used, and searchable metadata/payloads.

**Private object/file storage:** original JD PDFs, original resume PDFs, and ZIP files. Do not store actual PDFs in Qdrant.

## Phase roadmap

This is the supplied roadmap, not authorization to implement all phases. The user's subsequent phase-specific requests determine scope and can refine sequencing.

1. Recruiter foundation
2. New Analysis UI
3. JD text input
4. JD PDF upload + extraction
5. Resume single/multiple upload
6. Folder upload
7. ZIP upload
8. Resume processing pipeline
9. Top-K configuration
10. Basic matching
11. Vector retrieval
12. Hybrid retrieval
13. Reranking
14. Evidence generation
15. Results UI
16. Candidate detail
17. Search/filter/shortlist
18. Evaluation
19. Production hardening

Delivery constraint from the supplied workflow: start with single/multiple PDFs and verify the complete pipeline works before adding folder upload, then ZIP upload. Resolve sequencing against the user's requested phase as work proceeds; do not expand the current phase independently.

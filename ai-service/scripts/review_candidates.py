"""Explicit local acceptance review. Never modifies stored resumes or MongoDB."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.parsers.resume_pdf import extract
from app.models.resume_extraction import ResumeExtraction
from app.services.candidate import build_profile
from app.services.resume_chunks import build_chunks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true', required=True, help='Explicitly call configured Gemini for this local review')
    parser.add_argument('--limit', type=int, default=10)
    parser.add_argument('--synthetic', action='store_true', help='Use only fictional test resumes, never stored PDFs')
    args = parser.parse_args()
    if not 1 <= args.limit <= 10:
        parser.error('limit must be 1–10')
    # The local developer must opt in; do not print secrets or auto-load in services.
    for env_file in [ROOT.parent / 'Backend' / '.env', ROOT / '.env']:
        if env_file.exists():
            for line in env_file.read_text(encoding='utf-8-sig').splitlines():
                if '=' in line and not line.lstrip().startswith('#'):
                    key, value = line.split('=', 1)
                    if key.strip() in ['GOOGLE_GEN_API_KEY', 'RESUME_MODEL', 'OCR_TESSDATA_DIR', 'OCR_LANGUAGES']:
                        os.environ[key.strip()] = value.strip().strip('"').strip("'")
    output = ROOT / '.review' / ('synthetic' if args.synthetic else 'stored')
    output.mkdir(parents=True, exist_ok=True)
    if args.synthetic:
        from tests.review_resumes import SAMPLES
        sources = []
        for index, texts in enumerate(SAMPLES[:args.limit]):
            source = ResumeExtraction(rawText='\f'.join(texts), pages=[{'pageNumber': n+1, 'text': t} for n, t in enumerate(texts)],
                documentMetadata={'pageCount': len(texts)}, extractionStatus='PROCESSED', extractionMethod='text')
            sources.append((f'synthetic-{index+1}', hashlib.sha256(source.rawText.encode()).hexdigest(), source))
    else:
        sources = []
        for path in sorted((ROOT.parent / 'Backend' / '.private' / 'resumes').glob('*.pdf')):
            sources.append((path.name, hashlib.sha256(path.read_bytes()).hexdigest(), path))
    seen = set()
    reviewed = 0
    for name, digest, source in sources:
        if digest in seen:
            continue
        seen.add(digest)
        extracted = source if isinstance(source, ResumeExtraction) else ResumeExtraction.model_validate(extract(source))
        if extracted.extractionStatus != 'PROCESSED':
            continue
        number = reviewed + 1
        target = output / f'{number:02d}.json'
        if target.exists() and json.loads(target.read_text(encoding='utf-8')).get('pdfHash') == digest:
            result = json.loads(target.read_text(encoding='utf-8'))
            result.update(build_chunks(extracted, result['candidateProfile'], 'a'*24, f'{number:024x}'))
            target.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
            print(f'{number:02d}: existing review retained', flush=True)
        else:
            try:
                result = build_profile(extracted)
                result.update(build_chunks(extracted, result['candidateProfile'], 'a'*24, f'{number:024x}'))
                result.update(pdfHash=digest, sourceFile=name, pages=[p.model_dump() for p in extracted.pages])
                target.write_text(json.dumps(result, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
                print(f'{number:02d}: profile and {len(result["resumeChunks"])} chunks saved for manual inspection', flush=True)
            except Exception as error:
                cause = error.__cause__
                status = getattr(getattr(cause, 'response', None), 'status_code', None)
                print(f'{number:02d}: {type(error).__name__}, cause={type(cause).__name__}, HTTP={status}; review incomplete', flush=True)
                if args.synthetic and status:
                    message = cause.response.json().get('error', {}).get('message', '')
                    secret = os.environ.get('GOOGLE_GEN_API_KEY', '')
                    print(message.replace(secret, '[redacted]')[:1000] if secret else 'Model configuration unavailable.', flush=True)
                raise SystemExit(1) from None
        reviewed += 1
        if reviewed == args.limit:
            break
    print(f'{reviewed} distinct resumes available for manual inspection. Outputs are private/ignored.', flush=True)


if __name__ == '__main__':
    main()

"""Invoked in a bounded subprocess, never in the API process."""
import json
import sys
from pathlib import Path
import pymupdf
from app.models.resume_extraction import (
    DocumentMetadata, MAX_PAGES, MAX_TEXT_CHARACTERS, PAGE_SEPARATOR,
    ResumeExtraction, has_usable_text,
)


def extract(path):
    target = Path(path)
    if target.stat().st_size > 5 * 1024 * 1024:
        raise ValueError('PDF exceeds processing size limit.')
    with pymupdf.open(target) as document:
        if not document.is_pdf:
            raise ValueError('Only PDF documents are supported.')
        if document.needs_pass or document.is_encrypted or document.metadata.get('encryption'):
            raise ValueError('Encrypted PDFs are not supported.')
        if not 1 <= document.page_count <= MAX_PAGES:
            raise ValueError('PDF must contain 1 to 50 pages.')
        pages = []
        size = 0
        for page in document:
            text = page.get_text('text', sort=True)
            size += len(text)
            if size > MAX_TEXT_CHARACTERS:
                raise ValueError('PDF text exceeds 100,000 characters.')
            # Retain blank/image-only pages so later citations keep PDF numbering.
            pages.append({'pageNumber': page.number + 1, 'text': text})
        raw_text = PAGE_SEPARATOR.join(page['text'] for page in pages)
        metadata = {key: document.metadata.get(key) or '' for key in DocumentMetadata.model_fields if key != 'pageCount'}
        return ResumeExtraction.model_validate({
            'rawText': raw_text,
            'pages': pages,
            'documentMetadata': {**metadata, 'pageCount': document.page_count},
            'extractionStatus': 'PROCESSED' if has_usable_text(raw_text) else 'OCR_REQUIRED',
        }).model_dump()


if __name__ == '__main__':
    try:
        if sys.platform != 'win32':
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_CPU, (25, 25))
        print(json.dumps(extract(sys.argv[1])))
    except Exception:
        print(json.dumps({'error': 'PDF is unreadable, encrypted, or exceeds processing limits.'}))
        sys.exit(2)

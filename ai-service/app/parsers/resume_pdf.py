"""Invoked in a bounded subprocess, never in the API process."""
import json
import sys
from pathlib import Path
from pypdf import PdfReader


def extract(path):
    target = Path(path)
    if target.stat().st_size > 5 * 1024 * 1024:
        raise ValueError('PDF exceeds processing size limit.')
    reader = PdfReader(target, strict=True)
    if reader.is_encrypted:
        raise ValueError('Encrypted PDFs are not supported.')
    if len(reader.pages) > 50:
        raise ValueError('PDF exceeds 50 pages.')
    parts = []
    size = 0
    for page in reader.pages:
        text = page.extract_text() or ''
        size += len(text)
        if size > 100000:
            raise ValueError('PDF text exceeds 100,000 characters.')
        parts.append(text)
    text = '\n'.join(parts)
    if not text.strip():
        raise ValueError('No readable text found. Scanned PDFs require OCR.')
    return text


if __name__ == '__main__':
    try:
        if sys.platform != 'win32':
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_CPU, (25, 25))
        print(json.dumps({'text': extract(sys.argv[1])}))
    except Exception:
        print(json.dumps({'error': 'PDF is unreadable, encrypted, empty, or exceeds processing limits.'}))
        sys.exit(2)

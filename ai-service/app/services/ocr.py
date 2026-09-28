"""Replaceable, local OCR adapter. Only constructed when native text is insufficient."""
import os
import re
import unicodedata
from pathlib import Path
from typing import Protocol

DEFAULT_TESSDATA = Path(__file__).resolve().parents[2] / '.ocr' / 'tessdata'


class OcrUnavailable(RuntimeError):
    """OCR could not produce a result; the original PDF remains available."""


class OcrProvider(Protocol):
    def extract_page(self, page) -> str: ...


def normalize_ocr_text(text: str) -> str:
    text = unicodedata.normalize('NFC', text.replace('\r\n', '\n').replace('\r', '\n'))
    return ''.join(char for char in text if char in '\n\t' or not unicodedata.category(char).startswith('C')).strip()


class TesseractOcr:
    def __init__(self):
        self.language = os.getenv('OCR_LANGUAGES', 'eng')
        self.tessdata = Path(os.getenv('OCR_TESSDATA_DIR') or os.getenv('TESSDATA_PREFIX') or DEFAULT_TESSDATA)
        if not re.fullmatch(r'[a-zA-Z0-9_]+(?:\+[a-zA-Z0-9_]+)*', self.language):
            raise OcrUnavailable('Invalid OCR language configuration.')
        if not all((self.tessdata / f'{language}.traineddata').is_file() for language in self.language.split('+')):
            raise OcrUnavailable('OCR language data is unavailable.')

    def extract_page(self, page) -> str:
        # Bound raster memory before asking the native engine to render a page.
        if page.rect.width * page.rect.height * (200 / 72) ** 2 > 16_000_000:
            raise OcrUnavailable('Page exceeds OCR rendering limits.')
        try:
            textpage = page.get_textpage_ocr(language=self.language, dpi=200, full=True, tessdata=str(self.tessdata))
            return page.get_text('text', textpage=textpage, sort=True)
        except Exception as error:
            raise OcrUnavailable('OCR engine could not read this page.') from error


def get_ocr_provider() -> OcrProvider:
    # Provider-specific configuration stays here, outside the parser and worker.
    if os.getenv('OCR_PROVIDER', 'tesseract') != 'tesseract':
        raise OcrUnavailable('OCR provider is disabled or unavailable.')
    return TesseractOcr()

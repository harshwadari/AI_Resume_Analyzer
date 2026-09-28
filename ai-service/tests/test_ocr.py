import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
import pymupdf
from app.parsers.resume_pdf import extract
from app.services.ocr import DEFAULT_TESSDATA, OcrUnavailable, TesseractOcr, normalize_ocr_text
from tests.resume_pdf_fixtures import image_resume, text_resume
from tests import test_processing


class OcrTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.path = Path(folder.name) / 'resume.pdf'

    def read(self, pdf, provider):
        self.path.write_bytes(pdf)
        result = extract(self.path, ocr_provider=provider)
        self.assertEqual(self.path.read_bytes(), pdf)
        return result

    def test_native_text_never_constructs_or_invokes_ocr(self):
        with patch('app.parsers.resume_pdf.get_ocr_provider') as factory:
            result = self.read(text_resume(), None)
        factory.assert_not_called()
        self.assertEqual(result['extractionMethod'], 'text')
        self.assertEqual(result['extractionStatus'], 'PROCESSED')

    def test_scanned_and_mixed_documents_use_replaceable_provider_and_keep_pages(self):
        for mixed in [False, True]:
            with pymupdf.open(stream=image_resume(True), filetype='pdf') as document:
                if mixed:
                    with pymupdf.open(stream=text_resume(), filetype='pdf') as native:
                        document.insert_pdf(native, start_at=0)
                provider = Mock()
                provider.extract_page.return_value = 'Engineer\r\nSkills: Python\x00'
                result = self.read(document.tobytes(), provider)
            provider.extract_page.assert_called_once()
            self.assertEqual(result['extractionMethod'], 'ocr')
            self.assertEqual(result['extractionStatus'], 'PROCESSED')
            self.assertEqual(result['pages'][-1]['text'], 'Engineer\nSkills: Python')
            self.assertEqual(result['pages'][-1]['pageNumber'], 4 if mixed else 1)
            self.assertEqual(result['rawText'], '\f'.join(page['text'] for page in result['pages']))

    def test_short_header_does_not_hide_scanned_content(self):
        with pymupdf.open(stream=image_resume(), filetype='pdf') as document:
            document[0].insert_text((30, 20), 'Resume')
            provider = Mock()
            provider.extract_page.return_value = 'Software Engineer Python skills'
            result = self.read(document.tobytes(), provider)
        provider.extract_page.assert_called_once()
        self.assertEqual(result['extractionMethod'], 'ocr')

    def test_missing_provider_empty_ocr_and_render_limit_remain_explicit(self):
        for provider in [Mock(extract_page=Mock(side_effect=OcrUnavailable('private path'))),
                         Mock(extract_page=Mock(return_value=' 12 \ufffd '))]:
            result = self.read(image_resume(), provider)
            self.assertEqual(result['extractionStatus'], 'OCR_REQUIRED')
            self.assertEqual(result['ocrRequiredPages'], [1])
            self.assertNotIn('private path', str(result))
        with patch.dict(os.environ, {'OCR_TESSDATA_DIR': str(self.path.parent / 'missing')}):
            with self.assertRaises(OcrUnavailable):
                TesseractOcr()
        with patch.dict(os.environ, {'OCR_TESSDATA_DIR': str(DEFAULT_TESSDATA), 'OCR_LANGUAGES': '../eng'}):
            with self.assertRaises(OcrUnavailable):
                TesseractOcr()
        provider = TesseractOcr.__new__(TesseractOcr)
        oversized = Mock(rect=Mock(width=10000, height=10000))
        with self.assertRaisesRegex(OcrUnavailable, 'rendering limits'):
            provider.extract_page(oversized)
        oversized.get_textpage_ocr.assert_not_called()

    def test_ocr_output_cannot_bypass_text_size_limit(self):
        provider = Mock(extract_page=Mock(return_value='x' * 100001))
        with self.assertRaisesRegex(ValueError, '100,000'):
            self.read(image_resume(), provider)

    def test_normalization_keeps_unicode_and_line_breaks(self):
        self.assertEqual(normalize_ocr_text('  Jose\u0301\r\nPython\x00\f '), 'José\nPython')

    @unittest.skipUnless((DEFAULT_TESSDATA / 'eng.traineddata').is_file(), 'Run python scripts/setup_ocr.py for real OCR acceptance')
    def test_real_local_ocr_scanned_pdf_and_bounded_subprocess_persistence(self):
        from app.services import processing as work
        from uuid import uuid4
        # Real renderer + Tesseract + isolated parser + worker persistence; no mocked OCR.
        case = test_processing.ProcessingTests()
        case.setUp()
        self.addCleanup(case.doCleanups)
        key = f'{uuid4()}.pdf'
        target = self.path.parent / key
        data = image_resume(True)
        target.write_bytes(data)
        case.db.resumes.update_one({}, {'$set': {'storageReference': key}})
        with patch.dict(os.environ, {'RESUME_STORAGE_DIR': str(self.path.parent), 'OCR_PROVIDER': 'tesseract',
                                    'OCR_TESSDATA_DIR': str(DEFAULT_TESSDATA), 'OCR_LANGUAGES': 'eng'}):
            self.assertEqual(work.process_one(str(case.job), str(case.resume)), 'DONE')
        row = case.db.resumes.find_one()
        self.assertEqual(row['processingStatus'], 'PROCESSED')
        self.assertEqual(row['extractionMethod'], 'ocr')
        self.assertIn('Python', row['rawText'])
        self.assertIn('Engineer', row['pages'][0]['text'])
        self.assertEqual(row['ocrRequiredPages'], [])
        self.assertEqual(target.read_bytes(), data)

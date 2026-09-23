import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import pymupdf
from pydantic import ValidationError
from app.models.resume_extraction import ResumeExtraction, has_usable_text
from app.parsers.resume_pdf import extract
from tests.resume_pdf_fixtures import image_resume, text_resume


class ResumeExtractionTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.path = Path(folder.name) / 'resume.pdf'

    def read(self, data):
        self.path.write_bytes(data)
        result = extract(self.path)
        self.assertEqual(self.path.read_bytes(), data, 'Extraction must never modify the original PDF')
        return result

    def test_text_pages_reading_order_rotation_unicode_and_metadata(self):
        result = self.read(text_resume())
        self.assertEqual(result['extractionStatus'], 'PROCESSED')
        self.assertEqual([page['pageNumber'] for page in result['pages']], [1, 2, 3])
        first, blank, third = [page['text'] for page in result['pages']]
        self.assertLess(first.index('Jose Garcia'), first.index('Experience:'))
        self.assertEqual(blank, '')
        self.assertIn('Education: Computer Science', third)
        self.assertIn('Skills: Python, MongoDB, Node.js', third)
        self.assertIn('Español', third)
        self.assertEqual(result['rawText'], first + '\f\f' + third)
        metadata = result['documentMetadata']
        self.assertEqual(metadata['pageCount'], 3)
        self.assertEqual(metadata['title'], 'Synthetic Resume')
        self.assertEqual(metadata['author'], 'Test Candidate')
        self.assertEqual(metadata['creationDate'], 'D:20260102030405Z')
        self.assertTrue(metadata['format'].startswith('PDF'))

    def test_image_only_and_page_number_only_resumes_require_ocr(self):
        for page_number in [False, True]:
            with self.subTest(page_number=page_number):
                result = self.read(image_resume(page_number))
                self.assertEqual(result['extractionStatus'], 'OCR_REQUIRED')
                self.assertEqual(result['documentMetadata']['title'], 'Scanned Resume')
                self.assertEqual(result['pages'], [{'pageNumber': 1, 'text': result['rawText']}])
                self.assertEqual(result['rawText'].strip(), '1' if page_number else '')

    def test_blank_pages_remain_present_and_require_ocr(self):
        with pymupdf.open() as document:
            document.new_page()
            document.new_page()
            result = self.read(document.tobytes())
        self.assertEqual(result['extractionStatus'], 'OCR_REQUIRED')
        self.assertEqual(result['rawText'], '\f')
        self.assertEqual(result['pages'], [{'pageNumber': 1, 'text': ''}, {'pageNumber': 2, 'text': ''}])

    def test_mixed_text_and_image_pages_preserve_all_page_numbers(self):
        with pymupdf.open(stream=text_resume(), filetype='pdf') as document:
            with pymupdf.open(stream=image_resume(), filetype='pdf') as scanned:
                document.insert_pdf(scanned)
            result = self.read(document.tobytes())
        self.assertEqual(result['extractionStatus'], 'PROCESSED')
        self.assertEqual(result['documentMetadata']['pageCount'], 4)
        self.assertEqual(result['pages'][3], {'pageNumber': 4, 'text': ''})

    def test_non_latin_letters_are_usable_but_replacement_glyphs_are_not(self):
        with pymupdf.open() as document:
            document.new_page().insert_text((50, 60), '软件工程师', fontname='china-s')
            result = self.read(document.tobytes())
        self.assertIn('软件工程师', result['rawText'].replace(' ', ''))
        self.assertEqual(result['extractionStatus'], 'PROCESSED')
        self.assertFalse(has_usable_text('\ufffd\ufffd\u200b 12 ! \n'))

    def test_encrypted_and_excessive_page_documents_fail(self):
        for password in ['reader', '']:
            with self.subTest(password_required=bool(password)):
                with pymupdf.open(stream=text_resume(), filetype='pdf') as document:
                    encrypted = document.tobytes(encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw='owner', user_pw=password)
                with self.assertRaisesRegex(ValueError, 'Encrypted'):
                    self.read(encrypted)
        with pymupdf.open() as document:
            for _ in range(51):
                document.new_page()
            excessive = document.tobytes()
        with self.assertRaisesRegex(ValueError, '1 to 50 pages'):
            self.read(excessive)

    def test_non_pdf_content_cannot_be_processed_by_renaming_it(self):
        with pymupdf.open(stream=text_resume(), filetype='pdf') as document:
            image = document[0].get_pixmap().tobytes('png')
        with self.assertRaises((ValueError, pymupdf.FileDataError)):
            self.read(image)

    def test_document_text_limit_rejects_instead_of_truncating(self):
        with patch('app.parsers.resume_pdf.MAX_TEXT_CHARACTERS', 30):
            with self.assertRaisesRegex(ValueError, '100,000 characters'):
                self.read(text_resume())

    def test_parser_output_validation_rejects_inconsistent_or_unbounded_data(self):
        valid = self.read(text_resume())
        changes = [
            lambda data: data['pages'][1].update(pageNumber=3),
            lambda data: data.update(rawText='Altered text'),
            lambda data: data['documentMetadata'].update(pageCount=1),
            lambda data: data.update(extractionStatus='OCR_REQUIRED'),
            lambda data: data['pages'][0].update(text='x' * 100001),
            lambda data: data['documentMetadata'].update(author='x' * 10001),
            lambda data: data.update(unexpectedField='not allowed'),
        ]
        for index, change in enumerate(changes):
            with self.subTest(case=index):
                invalid = copy.deepcopy(valid)
                change(invalid)
                with self.assertRaises(ValidationError):
                    ResumeExtraction.model_validate(invalid)

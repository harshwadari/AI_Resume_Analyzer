"""Validated output of the isolated resume parser, before any MongoDB write."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_PAGES = 50
MAX_TEXT_CHARACTERS = 100_000
PAGE_SEPARATOR = '\f'


def has_usable_text(text: str) -> bool:
    # Whitespace, replacement glyphs, punctuation and page numbers alone are
    # not usable resume text. Unicode letters support non-English resumes too.
    return any(character.isalpha() for character in text)


class ResumePage(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    pageNumber: int = Field(ge=1, le=MAX_PAGES)
    text: str = Field(max_length=MAX_TEXT_CHARACTERS)


class DocumentMetadata(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, str_max_length=10_000)
    pageCount: int = Field(ge=1, le=MAX_PAGES)
    format: str = ''
    title: str = ''
    author: str = ''
    subject: str = ''
    keywords: str = ''
    creator: str = ''
    producer: str = ''
    creationDate: str = ''
    modDate: str = ''
    trapped: str = ''


class ResumeExtraction(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    rawText: str = Field(max_length=MAX_TEXT_CHARACTERS + MAX_PAGES - 1)
    pages: list[ResumePage] = Field(min_length=1, max_length=MAX_PAGES)
    documentMetadata: DocumentMetadata
    extractionStatus: Literal['PROCESSED', 'OCR_REQUIRED']

    @model_validator(mode='after')
    def consistent_document(self):
        if [page.pageNumber for page in self.pages] != list(range(1, len(self.pages) + 1)):
            raise ValueError('Page numbers must be sequential and one-based.')
        if self.documentMetadata.pageCount != len(self.pages):
            raise ValueError('Metadata page count does not match the document.')
        if sum(len(page.text) for page in self.pages) > MAX_TEXT_CHARACTERS:
            raise ValueError('PDF text exceeds 100,000 characters.')
        if self.rawText != PAGE_SEPARATOR.join(page.text for page in self.pages):
            raise ValueError('Raw text must preserve every page and its boundary.')
        expected = 'PROCESSED' if has_usable_text(self.rawText) else 'OCR_REQUIRED'
        if self.extractionStatus != expected:
            raise ValueError('Extraction status does not match usable text.')
        return self

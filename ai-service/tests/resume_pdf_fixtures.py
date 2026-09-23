"""Synthetic PDFs shared by parser tests and the HTTP/queue acceptance test."""
import base64
import json
import pymupdf


def text_resume():
    with pymupdf.open() as document:
        page = document.new_page()
        # Write out of visual order to exercise reading-order extraction.
        page.insert_text((50, 180), 'Experience: Built reliable Python services.')
        page.insert_text((50, 60), 'Jose Garcia - Senior Engineer')
        document.new_page()  # Intentionally blank: later page numbers must not shift.
        page = document.new_page()
        page.insert_text((50, 60), 'Education: Computer Science\nSkills: Python, MongoDB, Node.js')
        page.insert_text((50, 120), 'Languages: English, Español')
        page.set_rotation(90)
        document.set_metadata({'title': 'Synthetic Resume', 'author': 'Test Candidate',
                               'creator': 'PrepWise test fixture', 'creationDate': 'D:20260102030405Z'})
        return document.tobytes(deflate=True)


def image_resume(page_number=False):
    with pymupdf.open(stream=text_resume(), filetype='pdf') as source:
        image = source[0].get_pixmap().tobytes('png')
    with pymupdf.open() as document:
        page = document.new_page()
        page.insert_image(page.rect, stream=image)
        if page_number:
            page.insert_text((50, 800), '1')
        document.set_metadata({'title': 'Scanned Resume'})
        return document.tobytes(deflate=True)


if __name__ == '__main__':
    print(json.dumps({name: base64.b64encode(value).decode('ascii') for name, value in {
        'text': text_resume(), 'image': image_resume(),
    }.items()}))

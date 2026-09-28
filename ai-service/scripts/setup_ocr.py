"""Download pinned English language data once, never during a processing request."""
import hashlib
from pathlib import Path
from urllib.request import urlopen

URL = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/eng.traineddata'
SHA256 = '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2'
TARGET = Path(__file__).resolve().parents[1] / '.ocr' / 'tessdata' / 'eng.traineddata'


def main():
    if TARGET.is_file() and hashlib.sha256(TARGET.read_bytes()).hexdigest() == SHA256:
        print('English OCR language data is ready.')
        return
    with urlopen(URL, timeout=60) as response:
        data = response.read(8 * 1024 * 1024 + 1)
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise ValueError('OCR language data checksum mismatch; nothing installed.')
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    temporary = TARGET.with_suffix('.tmp')
    temporary.write_bytes(data)
    temporary.replace(TARGET)
    print('English OCR language data installed.')


if __name__ == '__main__':
    main()

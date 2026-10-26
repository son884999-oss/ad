"""Download official PDFs and inspect exact source lines before selecting crops."""
from pathlib import Path
import sys, urllib.request, json, hashlib

OUT = Path(__file__).resolve().parent
sys.path.insert(0, str(OUT.parent / '.pt_deps'))
import pymupdf as fitz

SOURCES = OUT / 'evidence'
SOURCES.mkdir(exist_ok=True)
cni_url = next(line.removeprefix('- 원문: ') for line in (OUT/'sources.md').read_text(encoding='utf-8').splitlines()
               if line.startswith('- 원문: https://www.cni'))
items = [
    ('mss_2024_release.pdf', 'https://www.mss.go.kr/common/board/Download.do?bcIdx=1066231&cbIdx=86&streFileNm=27cf5887-6e00-4c61-9100-22421758d9b6.pdf'),
    ('nabo_2025.pdf', 'https://www.nabo.go.kr/board/file/down.do?fid=33318912'),
    ('cni_397.pdf', cni_url),
]
metadata = []
for name, url in items:
    path = SOURCES/name
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=45) as response:
            data = response.read()
        if not data.startswith(b'%PDF'):
            raise ValueError(f'Not a PDF: {name}')
        path.write_bytes(data)
    data = path.read_bytes()
    assert data.startswith(b'%PDF')
    doc = fitz.open(path)
    metadata.append({'file': name, 'url': url, 'sha256': hashlib.sha256(data).hexdigest(), 'pages':len(doc)})
    for index, page in enumerate(doc):
        text = page.get_text()
        if (name.startswith('mss') and '27.2' in text) or (name.startswith('nabo') and index ==119) or (name.startswith('cni') and index in [3,4]):
            print(name, 'PAGE', index+1, 'SIZE', page.rect)
            for block in page.get_text('dict')['blocks']:
                for line in block.get('lines', []):
                    value = ''.join(span['text'] for span in line['spans'])
                    print(tuple(round(v,1) for v in line['bbox']), value)
(SOURCES/'download_manifest.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')

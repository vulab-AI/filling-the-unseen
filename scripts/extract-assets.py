"""Export actual manuscript images. Requires PyMuPDF and Poppler.

No generated, retouched, or enhanced results are used. Embedded JPEG bytes are
preserved. Some source PDFs contain obsolete images under the visible images;
selecting the last painted image at each grid cell avoids exporting those.
"""
from pathlib import Path
import json
import shutil
import subprocess
import pymupdf

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / '.paper-source' / 'fig'
ASSETS = ROOT / 'assets'
provenance = []


def export_image(doc, info, target):
    payload = doc.extract_image(info['xref'])
    assert payload['ext'] == 'jpeg', (target, payload['ext'])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload['image'])
    provenance.append({
        'asset': str(target.relative_to(ROOT)),
        'source': Path(doc.name).name,
        'page': 1,
        'xref': info['xref'],
        'bbox': list(info['bbox']),
        'width': payload['width'], 'height': payload['height'],
        'operation': 'Original embedded JPEG; no re-encoding or retouching',
    })


def grid(source, rows, cols, prefix):
    doc = pymupdf.open(SOURCE / source)
    images = [i for i in doc[0].get_image_info(xrefs=True)
              if i['width'] == 480 and i['height'] == 270]
    left = min(i['bbox'][0] for i in images)
    top = min(i['bbox'][1] for i in images)
    right = max(i['bbox'][2] for i in images)
    bottom = max(i['bbox'][3] for i in images)
    for row, method in enumerate(rows):
        for col in range(cols):
            center = pymupdf.Point(left + (right-left)*(col+.5)/cols,
                                   top + (bottom-top)*(row+.5)/len(rows))
            matches = [i for i in images if center in pymupdf.Rect(i['bbox'])]
            assert matches, (source, method, col)
            export_image(doc, matches[-1], ASSETS / 'results' / f'{prefix}-{method}-{col+1}.jpg')


grid('_bonsai.pdf', ['inpainted', 'original', 'genfusion', 'fsgs', 'guidedvd', 'ours'], 5, 'bonsai')
grid('_garden.pdf', ['inpainted', 'original', 'genfusion', 'fsgs', 'difix', 'guidedvd', 'ours'], 4, 'garden')
grid('_scannetpp_single_column.pdf', ['original', 'gt', 'guidedvd', 'difix', 'genfusion', 'ours'], 4, 'scannet')

doc = pymupdf.open(SOURCE / '_teaser.pdf')
for xref, name in [(7, 'garden-original'), (8, 'garden-ours'),
                   (9, 'bonsai-ours'), (10, 'bonsai-original'),
                   (11, 'indoor-ours'), (12, 'indoor-original')]:
    info = next(i for i in doc[0].get_image_info(xrefs=True) if i['xref'] == xref)
    export_image(doc, info, ASSETS / 'results' / f'teaser-{name}.jpg')

figures = {
    '_teaser.pdf': 'teaser',
    '_method_overview.pdf': 'method-overview',
    '_idpdt_camera_detection.pdf': 'independent-cameras',
    '_oa_mask_pipeline.pdf': 'qa-mask-pipeline',
    '_oa_mask_vis_and_compare.pdf': 'qa-mask-comparison',
    '_oa_mask_genfusion_difix.pdf': 'qa-mask-generalization',
    '_bonsai.pdf': 'bonsai-comparison',
    '_garden.pdf': 'garden-comparison',
    '_scannetpp_single_column.pdf': 'scannet-comparison',
}
(ASSETS / 'figures').mkdir(parents=True, exist_ok=True)
for original, name in figures.items():
    dest = ASSETS / 'figures' / name
    shutil.copyfile(SOURCE / original, dest.with_suffix('.pdf'))
    subprocess.run(['pdftoppm', '-scale-to', '2000', '-singlefile', '-png',
                    str(SOURCE / original), str(dest)], check=True)

(ROOT / '.work' / 'asset-provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
print(f'Exported {len(provenance)} original result images and {len(figures)} figures.')

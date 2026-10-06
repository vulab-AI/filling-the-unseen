"""Extract PPTX clips and encode browser-compatible copies without trimming.

Run: python scripts/extract-presentation-videos.py
Requires ffmpeg/ffprobe with libx264. The original presentation is not modified.
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import posixpath
import subprocess
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'supp videos.pptx'
WORK = ROOT / '.work/presentation-videos'
OUTPUT = ROOT / 'assets/video/presentation'
FFMPEG = '/usr/bin/ffmpeg'
FFPROBE = '/usr/bin/ffprobe'
NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
SCENES = [
    ('bonsai', 'Bonsai', 'Mip-NeRF 360'),
    ('garden', 'Garden', 'Mip-NeRF 360'),
    ('0e75f3c4d9', 'Workshop', 'ScanNet++'),
    ('569f99f881', 'Meeting room', 'ScanNet++'),
]
LABELS = {
    'genfusion': 'GenFusion', 'guidedvd': 'Guidedvd-3dgs',
    'fsgs': 'FSGS', 'difix': 'DiFix3D+', 'ours': 'Ours',
    'ours_difixed': 'Ours + DiFix3D',
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def probe(path):
    result = json.loads(subprocess.check_output([
        FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries',
        'stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_frames,duration',
        '-of', 'json', str(path),
    ]))
    return result['streams'][0]


def convert(clip):
    name = clip['name']
    source = WORK / f'{name}.mp4'
    target = OUTPUT / f'{name}.mp4'
    subprocess.run([
        FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
        '-map', '0:v:0', '-an', '-c:v', 'libx264', '-preset', 'slow',
        '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '2', '-vsync', '0',
        '-movflags', '+faststart', str(target),
    ], check=True)
    original, encoded = probe(source), probe(target)
    for field in ('width', 'height', 'r_frame_rate', 'nb_frames'):
        assert original[field] == encoded[field], (name, field, original, encoded)
    assert abs(float(original['duration']) - float(encoded['duration'])) < .001
    assert encoded['codec_name'] == 'h264'
    result = {
        **clip, 'src': f'assets/video/presentation/{name}.mp4',
        'poster': f'assets/video/presentation/{name}.png',
        'width': encoded['width'], 'height': encoded['height'],
        'duration': float(encoded['duration']), 'frames': int(encoded['nb_frames']),
        'fps': encoded['r_frame_rate'], 'codec': encoded['codec_name'],
        'sha256': digest(target.read_bytes()), 'bytes': target.stat().st_size,
    }
    print(f'{name}: {result["frames"]} frames, {result["duration"]:.3f}s, {result["bytes"]:,} bytes', flush=True)
    return result


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    clips = {}
    with zipfile.ZipFile(SOURCE) as archive:
        for slide in range(1, 12):
            xml = ET.fromstring(archive.read(f'ppt/slides/slide{slide}.xml'))
            rels = {r.attrib['Id']: r.attrib['Target'] for r in ET.fromstring(
                archive.read(f'ppt/slides/_rels/slide{slide}.xml.rels'))}
            for picture in xml.findall('.//p:pic', NS):
                video = picture.find('.//a:videoFile', NS)
                if video is None:
                    continue
                name = picture.find('.//p:cNvPr', NS).attrib['name']
                if name in clips:
                    clips[name]['slides'].append(slide)
                    continue
                scene, method = next((s, name[len(s)+1:]) for s, _, _ in SCENES if name.startswith(s + '_'))
                assert method in LABELS
                path = posixpath.normpath('ppt/slides/' + rels[video.attrib[f'{{{NS["r"]}}}link']])
                blip = picture.find('.//a:blip', NS)
                poster_path = posixpath.normpath('ppt/slides/' + rels[blip.attrib[f'{{{NS["r"]}}}embed']])
                data = archive.read(path)
                (WORK / f'{name}.mp4').write_bytes(data)
                (OUTPUT / f'{name}.png').write_bytes(archive.read(poster_path))
                clips[name] = {
                    'name': name, 'scene': scene, 'method': method, 'label': LABELS[method],
                    'source_entry': path, 'source_sha256': digest(data), 'slides': [slide],
                    'post_processing': 'DiFix3D at render time' if method == 'ours_difixed' else None,
                }
    assert len(clips) == 22
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        encoded = list(pool.map(convert, clips.values()))
    manifest = {
        'source': SOURCE.name, 'source_sha256': digest(SOURCE.read_bytes()),
        'conversion': 'H.264/libx264 CRF 18, yuv420p, fast-start; original dimensions, frame count, frame rate, and duration preserved. No trimming, interpolation, or image enhancement.',
        'scenes': [{
            'id': key, 'title': title, 'dataset': dataset,
            'clips': {clip['method']: clip for clip in encoded if clip['scene'] == key},
        } for key, title, dataset in SCENES],
    }
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Prepared {len(encoded)} clips from {SOURCE.name}.')


if __name__ == '__main__':
    main()

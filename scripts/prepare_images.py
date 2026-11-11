#!/usr/bin/env python3
"""Prepare high-quality responsive images from the originals (requires Pillow)."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import argparse
import json

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'content/images.json'
WIDTHS = (640, 1280, 1920, 2560)
CONTENT = json.loads((ROOT / 'content/portfolio.json').read_text())
CASE_IMAGES = {item['image'] for slug, project in CONTENT.items() if slug != 'home'
               for item in project['items'] if item['type'] == 'image'}


def prepare_case(item):
    """Encode from originals, retaining full resolution and existing fallbacks."""
    name, metadata = item
    source = ROOT / metadata['source']
    previous = {entry['width']: entry for entry in metadata['files']}
    files, avif = [], []
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        width, height = image.size
        for size in [s for s in WIDTHS if s < width] + [width]:
            scaled = image if size == width else image.resize(
                (size, round(height * size / width)), Image.Resampling.LANCZOS)
            for extension, options, entries in (
                ('webp', {'quality': 90, 'method': 6}, files),
                ('avif', {'quality': 75, 'speed': 6, 'subsampling': '4:4:4', 'max_threads': 1}, avif),
            ):
                target = ROOT / f'assets/{name}-opt-{size}.{extension}'
                scaled.save(target, extension.upper(), **options)
                entry = {'src': target.relative_to(ROOT).as_posix(), 'width': size,
                         'bytes': target.stat().st_size}
                # Never make the WebP/JPEG fallback heavier than before.
                old = previous.get(size)
                if (extension == 'webp' and old and old['src'] != entry['src']
                        and old['bytes'] < entry['bytes']):
                    target.unlink()
                    entry = old
                entries.append(entry)
    metadata.update(width=width, height=height, case_files=files, case_avif=avif)
    print(f'Prepared {name}', flush=True)
    return name, metadata


def prepare(item):
    name, metadata = item
    if name in CASE_IMAGES:
        return prepare_case(item)
    if metadata.get('optimized'):
        name, metadata = prepare_case(item)
        metadata['files'] = metadata.pop('case_files')
        metadata['avif'] = metadata.pop('case_avif')
        return name, metadata
    source = ROOT / metadata['source']
    old_files = {entry['src'] for entry in metadata['files']}
    files = []
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        width, height = image.size
        sizes = (160, 320) if name == 'portrait' else WIDTHS
        for size in sizes:
            if size >= width:
                continue
            target = ROOT / f'assets/{name}-hq-{size}.webp'
            image.resize((size, round(height * size / width)), Image.Resampling.LANCZOS).save(
                target, 'WEBP', quality=95, method=6
            )
            files.append({'src': target.relative_to(ROOT).as_posix(), 'width': size, 'bytes': target.stat().st_size})
    # The largest candidate is the original file, without another lossy encode.
    files.append({'src': metadata['source'], 'width': width, 'bytes': source.stat().st_size})
    metadata.update(width=width, height=height, files=files)
    for obsolete in old_files - {entry['src'] for entry in files}:
        (ROOT / obsolete).unlink(missing_ok=True)
    return name, metadata


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cases-only', action='store_true', help='Leave home images unchanged')
    parser.add_argument('--image', action='append', help='Prepare only the named catalog image (repeatable)')
    args = parser.parse_args()
    images = json.loads(CATALOG.read_text())
    if args.image and set(args.image) - images.keys():
        parser.error('Unknown image: ' + ', '.join(sorted(set(args.image) - images.keys())))
    selected = [(name, data) for name, data in images.items()
                if (not args.cases_only or name in CASE_IMAGES)
                and (not args.image or name in args.image)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        images.update(pool.map(prepare, selected))
    CATALOG.write_text(json.dumps(images, ensure_ascii=False, indent=2) + '\n')
    print(f'Prepared {len(selected)} images; original files retained.')

#!/usr/bin/env python3
"""Prepare high-quality responsive images from the originals (requires Pillow)."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'content/images.json'
WIDTHS = (640, 1280, 1920, 2560)


def prepare(item):
    name, metadata = item
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
    images = json.loads(CATALOG.read_text())
    with ThreadPoolExecutor(max_workers=6) as pool:
        prepared = dict(pool.map(prepare, images.items()))
    CATALOG.write_text(json.dumps(prepared, ensure_ascii=False, indent=2) + '\n')
    print(f'Prepared {len(prepared)} images with original-resolution fallbacks.')

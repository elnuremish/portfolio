#!/usr/bin/env python3
"""Embed tiny previews so galleries never begin as empty black rectangles."""
import base64
import io
import json
from pathlib import Path
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parents[1]

def preview(path):
    with Image.open(ROOT / path) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        image.thumbnail((96, 96), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, 'JPEG', quality=35, optimize=True)
        return 'data:image/jpeg;base64,' + base64.b64encode(buffer.getvalue()).decode()

images_path = ROOT / 'content/images.json'
content_path = ROOT / 'content/portfolio.json'
images = json.loads(images_path.read_text())
content = json.loads(content_path.read_text())
for slug, project in content.items():
    if slug == 'home':
        continue
    for item in project['items']:
        if item['type'] == 'image':
            data = images[item['image']]
            data['preview'] = preview(data['source'])
        elif item['type'] in ('embed', 'video'):
            item['preview'] = preview(item.get('poster', 'assets/nebesnaya-motion-poster.webp'))
images_path.write_text(json.dumps(images, ensure_ascii=False, indent=2) + '\n')
content_path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')

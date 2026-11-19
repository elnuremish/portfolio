#!/usr/bin/env python3
"""Re-encode retained desktop video sources for faster delivery; requires ffmpeg."""
import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def optimize(item, ffmpeg):
    source = item.setdefault('sourceSrc', item['src'])
    stem = Path(source).stem.rsplit('-', 1)[0]
    silent = item.get('hasAudio') is False
    suffix = '-silent' if silent else ''
    target = ROOT / f'assets/{stem}-fast-1080{suffix}.mp4'
    current = ROOT / item['src']
    if not target.exists():
        temporary = target.with_suffix('.tmp.mp4')
        audio = ['-an'] if silent else ['-c:a', 'aac', '-b:a', '80k']
        subprocess.run([
            ffmpeg, '-y', '-v', 'error', '-i', str(ROOT / source),
            '-vf', 'scale=-2:min(1080\\,ih)', '-r', '30',
            '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
            '-maxrate', '2200k', '-bufsize', '4400k', '-g', '30',
            '-pix_fmt', 'yuv420p', *audio, '-movflags', '+faststart', str(temporary),
        ], check=True)
        temporary.replace(target)
    if target.stat().st_size < current.stat().st_size:
        item['src'] = target.relative_to(ROOT).as_posix()
    # Keep existing variants: another source entry may still reference them.
    print(item['src'], flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    args = parser.parse_args()
    path = ROOT / 'content/portfolio.json'
    content = json.loads(path.read_text())
    for slug, project in content.items():
        if slug != 'home':
            for item in project['items']:
                if item['type'] in ('embed', 'video'):
                    optimize(item, args.ffmpeg)
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')

#!/usr/bin/env python3
"""Cache public portfolio videos as fast-start MP4s. Requires ffmpeg on PATH.

Original videos remain available at their Kinescope links. Desktop keeps the
1080p H.264 stream; phones get a 720p encode with a bounded bitrate.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def read_url(url):
    with urlopen(url, timeout=45) as response:
        return response.read().decode()


def prepare(item, ffmpeg):
    video_id = item['id']
    desktop = ROOT / f'assets/video-{video_id}-1080.mp4'
    mobile = ROOT / f'assets/video-{video_id}-720.mp4'
    desktop_temp = desktop.with_suffix('.tmp.mp4')
    mobile_temp = mobile.with_suffix('.tmp.mp4')
    if not desktop.exists():
        html = read_url(f'https://kinescope.io/{video_id}')
        options = json.loads(re.search(r'var playerOptions = (.*?);\s', html, re.S)[1])
        master_url = options['playlist'][0]['sources']['hls']['src']
        manifest = read_url(master_url)
        variants = re.findall(r'#EXT-X-STREAM-INF:([^\n]+)\n([^\n]+)', manifest)
        variants = [(int(re.search(r'RESOLUTION=\d+x(\d+)', attrs)[1]), url)
                    for attrs, url in variants]
        _, video_url = max((height, url) for height, url in variants if height <= 1080)
        audio = re.search(r'#EXT-X-MEDIA:TYPE=AUDIO[^\n]+URI="([^"]+)"', manifest)
        command = [ffmpeg, '-y', '-loglevel', 'error', '-i', urljoin(master_url, video_url)]
        if audio:
            command += ['-i', urljoin(master_url, audio[1]), '-map', '0:v:0', '-map', '1:a:0']
        command += ['-c', 'copy', '-movflags', '+faststart', str(desktop_temp)]
        subprocess.run(command, check=True)
        desktop_temp.replace(desktop)
    if not mobile.exists():
        subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', str(desktop),
                        '-vf', "scale=-2:'min(720,ih)'", '-r', '30',
                        '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
                        '-maxrate', '1800k', '-bufsize', '3600k', '-g', '60',
                        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k',
                        '-movflags', '+faststart', str(mobile_temp)], check=True)
        mobile_temp.replace(mobile)
    item['src'] = desktop.relative_to(ROOT).as_posix()
    item['mobileSrc'] = mobile.relative_to(ROOT).as_posix()
    print(video_id, 'desktop:', desktop.stat().st_size,
          'mobile:', mobile.stat().st_size, flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    args = parser.parse_args()
    path = ROOT / 'content/portfolio.json'
    content = json.loads(path.read_text())
    for slug, project in content.items():
        if slug != 'home':
            for item in project['items']:
                if item['type'] == 'embed':
                    prepare(item, args.ffmpeg)
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n')

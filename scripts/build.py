#!/usr/bin/env python3
"""Build all static pages from content/ using only Python's standard library."""
from pathlib import Path
from html import escape
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
CONTENT=json.loads((ROOT/'content/portfolio.json').read_text())
IMAGES=json.loads((ROOT/'content/images.json').read_text())
ORDER=['scherdakov','adat','nebesnaya','other']
def e(value):return escape(str(value),quote=True)
def revision(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()[:10]
CSS=revision('site.css');JS=revision('site.js')
def image(key, alt='', eager=False, profile=False, extra=''):
    data = IMAGES[key]
    files = data['files']
    fallback = files[-1 if profile else min(1, len(files) - 1)]
    sizes = ('(max-width:379px) 88px, (max-width:809px) 124px, 246px'
             if profile else '(max-width:809px) calc(100vw - 36px), 100vw')
    attributes = {
        'src': fallback['src'],
        'srcset': ', '.join(f'{entry["src"]} {entry["width"]}w' for entry in files),
        'sizes': sizes,
        'width': data['width'],
        'height': data['height'],
        'alt': alt,
        'loading': 'eager' if eager else 'lazy',
        'decoding': 'async',
    }
    if eager and not profile:
        attributes['fetchpriority'] = 'high'
    markup = ' '.join(f'{name}="{e(value)}"' for name, value in attributes.items())
    return '<img ' + markup + (' ' + extra if extra else '') + '>'

def contacts():
 return '<nav class="contact-links" aria-label="Контакты"><a class="text-link" href="https://t.me/elnuremish" target="_blank" rel="noopener noreferrer">контакт</a><a class="text-link" href="https://t.me/em16sh" target="_blank" rel="noopener noreferrer">телеграм канал</a><a class="text-link" href="mailto:elnuremish@gmail.com">почта</a></nav>'
def head(title,description,slug):
 return f'''<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{e(description)}">
  <meta name="theme-color" content="#ffffff">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(description)}">
  <meta property="og:type" content="website">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="site.css?v={CSS}">
  <title>{e(title)}</title>
  <script src="site.js?v={JS}" defer></script>
</head>
<body>
<a class="skip-link" href="#main">К содержимому</a>'''
def render_home():
 home=CONTENT['home'];parts=[head(home['name']+' — Портфолио','Портфолио коммуникационного и продуктового дизайнера Эльнура Агабалаева.','index')]
 parts.append('<aside class="profile" aria-label="Профиль дизайнера">')
 parts.append(image(home['portrait'],home['name'],True,True,'class="portrait"'))
 parts.append('<div class="profile-info"><h1>'+e(home['name'])+'</h1><p class="profile-bio">'+'<br>'.join(e(s) for s in home['bio'])+'</p></div>'+contacts()+'</aside>')
 parts.append('<main id="main" class="portfolio"><div class="project-feed">')
 for number,card in enumerate(home['cards']):
  slug=card['slug'];title=CONTENT[slug]['title'];parts.append(f'<figure class="project-card"><a class="project-cover" href="{slug}.html" aria-label="Открыть проект {e(title)}">'+image(card['image'],title,eager=number==0)+('<span class="project-badge">Новый проект</span>' if number==0 else '')+'</a><figcaption>'+e(card['caption'])+'</figcaption></figure>')
 parts.append('</div></main></body></html>')
 (ROOT/'index.html').write_text('\n'.join(parts)+'\n')
def render_project(slug):
 project=CONTENT[slug];title=project['title'];first_about=next(i for i in project['items'] if i['type']=='about');description=' '.join(first_about['paragraphs'])
 parts=[head(title+' — Агабалаев Эльнур',description,slug),'<header class="project-header"><a class="text-link" href="index.html">Назад</a>'+contacts()+'</header>','<main id="main" class="project-gallery">']
 about_count=0
 for index,item in enumerate(project['items']):
  kind=item['type'];ratio=item.get('ratio',16/9)
  if kind=='about':
   heading='h1' if about_count==0 else 'h2';about_count+=1
   parts.append('<section class="project-about"><'+heading+'>'+e(item['title'])+'</'+heading+'><div class="project-description">'+''.join('<p>'+e(p)+'</p>' for p in item['paragraphs'])+'</div></section>')
  elif kind=='image':
   sizes='(max-width:809px) 100vw, 100vw'
   parts.append(f'<figure class="media gallery-image" style="--ratio:{ratio}">'+image(item['image'],f'{title} — {index+1}',index==0).replace('sizes="(max-width:809px) calc(100vw - 36px), 100vw"',f'sizes="{sizes}"')+'</figure>')
  elif kind=='embed':
   video_title=f'{title} — видео {index+1}'
   parts.append(f'''<div class="media embedded-video" style="--ratio:{ratio}" data-embed="{e(item['id'])}" data-title="{e(video_title)}">
  <button class="video-button" type="button" aria-label="Воспроизвести: {e(video_title)}"><span class="play-icon" aria-hidden="true">▶</span><span>Смотреть видео</span></button>
  <span class="video-status" role="status"></span>
  <a class="video-link" href="https://kinescope.io/{e(item['id'])}" target="_blank" rel="noopener noreferrer">Открыть в Kinescope ↗</a>
</div>''')
  elif kind=='video':
   parts.append(f'''<div class="media local-video" style="--ratio:{ratio}">
  <video data-src="{e(item['src'])}" data-mobile-src="{e(item['mobileSrc'])}" poster="assets/nebesnaya-motion-poster.webp" width="1920" height="1036" loop muted playsinline preload="none" aria-label="Анимация Небесной канцелярии"></video>
  <button type="button" class="video-toggle">Воспроизвести</button>
  <noscript><a class="video-link" href="{e(item['mobileSrc'])}">Открыть видео ↗</a></noscript>
</div>''')
 parts.append('</main>')
 next_slug=ORDER[(ORDER.index(slug)+1)%len(ORDER)]
 parts.append('<footer class="project-footer"><a href="index.html">Вернуться на главную</a><a class="next-project" href="'+next_slug+'.html">Следующий проект</a></footer></body></html>')
 (ROOT/(slug+'.html')).write_text('\n'.join(parts)+'\n')
if __name__=='__main__':
 render_home()
 for slug in ORDER:render_project(slug)
 print('Built 5 pages. No dependencies or browser-side framework required.')

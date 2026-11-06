#!/usr/bin/env python3
"""Build all static pages from content/ using only Python's standard library."""
from pathlib import Path
from html import escape
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
CONTENT=json.loads((ROOT/'content/portfolio.json').read_text())
IMAGES=json.loads((ROOT/'content/images.json').read_text())
ORDER=['scherdakov','adat','nebesnaya','other']
def e(value):return escape(str(value),quote=True)

# Bind Russian prepositions, pronouns and short words to the following word.
# This is applied to prose only; attributes, URLs and metadata stay plain text.
BOUND_WORDS = frozenset('''
а без безо благодаря близ в во вдоль взамен включая вместо вне внутри вокруг
вопреки вслед вследствие для до за и из из-за из-под исключая к ко касательно
кроме меж между на над надо напротив насчёт насчет невзирая несмотря о об обо
около от ото перед передо по под подо позади после посредством при про против
путём путем ради с со сверх сквозь согласно среди спустя у через
но да не ни бы же ли
я меня тебе тебя нами вами себя мной мною тобой тобою собой собою него нему нею ними
мой моя моё мои твой твоя твоё твои свой своя своё свои моего моей моему моим
твоего твоей твоему твоим своего своей своему своим своих нашего нашей наших
вашего вашей ваших этому этого этой этим этих
наша наше наши ваша ваше ваши этот эта это эти этого этому этой этим этих
такой такая такие который которая которое которые которого которой которым которых которую которыми
'''.split())


def is_bound_word(token):
    word = token.strip('«»„“"()[]{}.,!?;:…‘’').casefold()
    return word in BOUND_WORDS or re.fullmatch(r'[а-яёa-z]{2,3}', word) is not None


def prose(value):
    """Escape visible text and keep a function-word group on one line."""
    value = str(value)
    words = list(re.finditer(r'\S+', value))
    parts = []
    cursor = 0
    index = 0
    while index < len(words) - 1:
        if not is_bound_word(words[index].group()):
            index += 1
            continue
        start = words[index].start()
        while index < len(words) - 1:
            if not is_bound_word(words[index].group()):
                break
            index += 1
        end = words[index].end()
        group = re.sub(r'\s+', '\u00a0', value[start:end])
        parts.extend((e(value[cursor:start]), '<span class="text-keep">', e(group), '</span>'))
        cursor = end
        index += 1
    parts.append(e(value[cursor:]))
    return ''.join(parts)

def revision(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()[:10]
CSS=revision('site.css');JS=revision('site.js')
def image(key, alt='', eager=False, profile=False, extra=''):
    data = IMAGES[key]
    files = data['files']
    fallback = files[-1 if profile else min(1, len(files) - 1)]
    sizes = ('(max-width:809px) 124px, 246px'
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
  <link rel="icon" href="favicon.ico?v=16" sizes="16x16 32x32 48x48">
  <link rel="icon" href="favicon.svg?v=16" type="image/svg+xml">
  <link rel="apple-touch-icon" href="apple-touch-icon.png?v=16">
  <link rel="stylesheet" href="site.css?v={CSS}">
  <title>{e(title)}</title>
  <script src="site.js?v={JS}" defer></script>
</head>
<body>
<a class="skip-link" href="#main">{prose('К содержимому')}</a>'''
def render_home():
 home=CONTENT['home'];parts=[head(home['name']+' — Портфолио','Портфолио коммуникационного и продуктового дизайнера Эльнура Агабалаева.','index')]
 parts.append('<aside class="profile" aria-label="Профиль дизайнера">')
 parts.append(image(home['portrait'],home['name'],True,True,'class="portrait"'))
 parts.append('<div class="profile-info"><h1>'+prose(home['name'])+'</h1><p class="profile-bio">'+'<br>'.join(prose(s) for s in home['bio'])+'</p></div>'+contacts()+'</aside>')
 parts.append('<main id="main" class="portfolio"><div class="project-feed">')
 for number,card in enumerate(home['cards']):
  slug=card['slug'];title=CONTENT[slug]['title'];parts.append(f'<figure class="project-card"><a class="project-cover" href="{slug}.html" aria-label="Открыть проект {e(title)}">'+image(card['image'],title,eager=number==0)+('<span class="project-badge">Новый проект</span>' if number==0 else '')+'</a><figcaption>'+prose(card['caption'])+'</figcaption></figure>')
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
   parts.append('<section class="project-about"><'+heading+'>'+prose(item['title'])+'</'+heading+'><div class="project-description">'+''.join('<p>'+prose(p)+'</p>' for p in item['paragraphs'])+'</div></section>')
  elif kind=='image':
   sizes='(max-width:809px) 100vw, 100vw'
   parts.append(f'<figure class="media gallery-image" style="--ratio:{ratio}">'+image(item['image'],f'{title} — {index+1}',index==0).replace('sizes="(max-width:809px) calc(100vw - 36px), 100vw"',f'sizes="{sizes}"')+'</figure>')
  elif kind=='embed':
   video_title=f'{title} — видео {index+1}'
   parts.append(f'''<div class="media embedded-video" style="--ratio:{ratio}" data-embed="{e(item['id'])}" data-title="{e(video_title)}">
  <button class="video-button" type="button" aria-label="Воспроизвести: {e(video_title)}"><span class="play-icon" aria-hidden="true">▶</span><span>Смотреть видео</span></button>
  <span class="video-status" role="status"></span>
  <a class="video-link" href="https://kinescope.io/{e(item['id'])}" target="_blank" rel="noopener noreferrer">{prose('Открыть в Kinescope ↗')}</a>
</div>''')
  elif kind=='video':
   parts.append(f'''<div class="media local-video" style="--ratio:{ratio}">
  <video data-src="{e(item['src'])}" data-mobile-src="{e(item['mobileSrc'])}" poster="assets/nebesnaya-motion-poster.webp" width="1920" height="1036" loop muted playsinline preload="none" aria-label="Анимация Небесной канцелярии"></video>
  <button type="button" class="video-toggle">Воспроизвести</button>
  <noscript><a class="video-link" href="{e(item['mobileSrc'])}">Открыть видео ↗</a></noscript>
</div>''')
 parts.append('</main>')
 next_slug=ORDER[(ORDER.index(slug)+1)%len(ORDER)]
 parts.append('<footer class="project-footer"><a href="index.html"><svg class="footer-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 4-5 5 5 5M4 9h10a6 6 0 0 1 0 12"/></svg><span>'+prose('Вернуться на главную')+'</span></a><a class="next-project" href="'+next_slug+'.html"><span>Следующий проект</span><svg class="footer-arrow" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/></svg></a></footer></body></html>')
 (ROOT/(slug+'.html')).write_text('\n'.join(parts)+'\n')
if __name__=='__main__':
 render_home()
 for slug in ORDER:render_project(slug)
 print('Built 5 pages. No dependencies or browser-side framework required.')

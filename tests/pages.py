"""Check language navigation, translation coverage and unchanged media selection."""
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.tags = []
        self.text = []
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))

    def handle_data(self, text):
        self.text.append(text)


for slug in ('index', 'scherdakov', 'adat', 'nebesnaya', 'other'):
    pages = [Page(ROOT / f'{slug}{suffix}.html') for suffix in ('', '-en')]
    for page, lang, suffix in zip(pages, ('ru', 'en'), ('', '-en')):
        assert page.tags[0] == ('html', {'lang': lang})
        switches = [a for tag, a in page.tags if tag == 'nav' and a.get('class') == 'language-switch']
        assert len(switches) == 1
        target = f'{slug}{"-en" if lang == "ru" else ""}.html'
        assert any(a.get('href') == target and a.get('hreflang') for tag, a in page.tags if tag == 'a')
        for tag, attrs in page.tags:
            if tag == 'a' and attrs.get('href', '').endswith('.html'):
                assert (ROOT / attrs['href']).is_file(), attrs
                if not attrs.get('hreflang'):
                    assert attrs['href'].endswith('-en.html') == (lang == 'en'), attrs
        if lang == 'en':
            assert not re.search('[А-Яа-яЁё]', ''.join(page.text)), slug
            assert 'telegram channel' in ''.join(page.text), slug
            assert 'Telegram channel' not in ''.join(page.text), slug
        media = [(tag, {k: v for k, v in a.items() if k not in ('alt', 'aria-label', 'title')})
                 for tag, a in page.tags if tag in ('video', 'img', 'source')]
        if lang == 'ru':
            original_media = media
        else:
            assert media == original_media, f'{slug}: translated page changed media loading'
    print(f'{slug}: RU/EN links, text and media verified')

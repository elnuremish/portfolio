// Load visible players after the first gallery image, so video downloads do not
// compete with the initial content. Autoplay works on mobile and desktop.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Only the home page has a profile. Scroll direction uses a small dead zone so
// trackpad noise and the mobile overscroll bounce do not toggle the card.
function setupProfile() {
  const profile = document.querySelector('.profile');
  if (!profile) return;
  const slot = profile.parentElement;
  const expanded = profile.querySelector('.profile-expanded');
  const compact = profile.querySelector('.profile-compact');
  let collapsed = false;
  let previousY = Math.max(0, window.scrollY);
  let travel = 0;
  let direction = 0;
  let scrollFrame = 0;
  let resizeFrame = 0;
  let maxScroll = 0;

  const setCollapsed = value => {
    if (value === collapsed) return;
    // A keyboard user must not lose focus when a panel becomes inert.
    const active = document.activeElement;
    const links = [...(collapsed ? compact : expanded).querySelectorAll('a')];
    const focusIndex = links.indexOf(active);
    collapsed = value;
    const shown = collapsed ? compact : expanded;
    const hidden = collapsed ? expanded : compact;
    shown.inert = false;
    shown.removeAttribute('aria-hidden');
    profile.classList.toggle('is-collapsed', collapsed);
    if (focusIndex !== -1) shown.querySelectorAll('a')[focusIndex].focus({preventScroll:true});
    hidden.inert = true;
    hidden.setAttribute('aria-hidden', 'true');
  };

  const measure = () => {
    resizeFrame = 0;
    // Measure the untransformed content, including when it is folded away.
    profile.style.setProperty('--profile-viewport-width', `${document.documentElement.clientWidth}px`);
    profile.style.setProperty('--profile-expanded-width', `${expanded.offsetWidth}px`);
    profile.style.setProperty('--profile-expanded-height', `${expanded.offsetHeight}px`);
    profile.style.setProperty('--profile-compact-width', `${compact.offsetWidth}px`);
    slot.style.setProperty('--profile-expanded-height', `${expanded.offsetHeight}px`);
    maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    previousY = Math.min(maxScroll, Math.max(0, window.scrollY));
    travel = 0;
  };

  const update = () => {
    scrollFrame = 0;
    const y = Math.min(maxScroll, Math.max(0, window.scrollY));
    const delta = y - previousY;
    previousY = y;
    if (y <= 24) {
      setCollapsed(false);
      travel = 0;
      return;
    }
    if (!delta) return;
    const nextDirection = Math.sign(delta);
    travel = nextDirection === direction ? travel + Math.abs(delta) : Math.abs(delta);
    direction = nextDirection;
    if (travel >= 28) {
      if (direction < 0 || y > 80) setCollapsed(direction > 0);
      travel = 0;
    }
  };

  compact.hidden = false;
  profile.classList.add('is-enhanced');
  slot.classList.add('is-enhanced');
  measure();
  setCollapsed(previousY > 80);
  requestAnimationFrame(() => profile.classList.add('is-animated'));
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(update);
  }, {passive:true});
  window.addEventListener('resize', () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(measure);
  }, {passive:true});
  window.addEventListener('pageshow', () => {
    measure();
    setCollapsed(previousY > 80);
  });
  document.fonts.ready.then(measure);
}
setupProfile();

// One observer for mobile covers; no work on every scroll frame.
function setupCoverVisibility() {
  const feed = document.querySelector('.project-feed');
  if (!feed || !('IntersectionObserver' in window)) return;
  const mobile = matchMedia('(max-width:809.98px)');
  const covers = feed.querySelectorAll('.project-cover');
  let observer;
  const update = () => {
    observer?.disconnect();
    feed.classList.toggle('has-scroll-color', mobile.matches);
    covers.forEach(cover => cover.classList.remove('is-visible'));
    if (!mobile.matches) return;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.classList.toggle('is-visible', entry.intersectionRatio >= .5);
      }
    }, {threshold:.5});
    covers.forEach(cover => observer.observe(cover));
  };
  update();
  mobile.addEventListener('change', update);
}
setupCoverVisibility();

const connection = navigator.connection;
const saveData = Boolean(connection?.saveData);
const slowConnection = saveData || /(^|-)2g$/.test(connection?.effectiveType || '');
// Keep this separate from window.load, which can wait for unrelated images.
const firstImage = document.querySelector('.gallery-image img[fetchpriority="high"]');
const initialMediaReady = new Promise(resolve => {
  if (!firstImage || firstImage.complete) resolve();
  else {
    firstImage.addEventListener('load', resolve, {once:true});
    firstImage.addEventListener('error', resolve, {once:true});
  }
}).then(() => new Promise(resolve => {
  if ('requestIdleCallback' in window) requestIdleCallback(resolve, {timeout:1000});
  else setTimeout(resolve, 0);
}));
let playerFactoryPromise;
function getPlayerFactory() {
  if (playerFactoryPromise) return playerFactoryPromise;
  playerFactoryPromise = new Promise((resolve, reject) => {
    window.onKinescopeIframeAPIReady = resolve;
    const script = document.createElement('script');
    script.src = 'https://player.kinescope.io/latest/iframe.player.js';
    script.async = true;
    script.addEventListener('error', reject, {once:true});
    document.head.append(script);
  });
  return playerFactoryPromise;
}
async function loadEmbed(container, userInitiated = false) {
  if (container.dataset.loaded) return;
  container.dataset.loaded = 'true';
  container.setAttribute('aria-busy', 'true');
  const status = container.querySelector('.video-status');
  status.textContent = 'Загрузка видео…';
  const timer = setTimeout(() => {
    status.textContent = 'Видео загружается. Можно открыть его в\u00a0Kinescope ↗';
  }, 15000);
  try {
    const factory = await getPlayerFactory();
    const frame = document.createElement('iframe');
    frame.id = `player-${container.dataset.embed}`;
    frame.title = container.dataset.title;
    frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    frame.allowFullscreen = true;
    container.append(frame);
    const player = await factory.create(frame.id, {
      url: `https://kinescope.io/${container.dataset.embed}`,
      size: {width:'100%', height:'100%'},
      behavior: {
        preload: slowConnection ? false : 'metadata',
        autoPlay: !userInitiated && !reducedMotion.matches && !slowConnection ? 'viewable' : false,
        playback: 'visible',
        autoPause: true,
        muted: true,
        loop: true,
        playsInline: true,
        localStorage: {time:false},
      },
      ui: {language:'ru'},
    });
    container.classList.add('is-ready');
    if (userInitiated) player.play().catch(() => {});
    const pauseWhenHidden = () => { if (document.hidden) player.pause().catch(() => {}); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    reducedMotion.addEventListener('change', event => { if (event.matches) player.pause().catch(() => {}); });
  } catch {
    status.textContent = 'Плеер недоступен. Откройте видео в\u00a0Kinescope ↗';
    container.querySelector('.video-button').hidden = true;
  } finally {
    clearTimeout(timer);
    container.setAttribute('aria-busy', 'false');
  }
}
const visibleEmbeds = new Set();
const startVisibleEmbed = container => {
  initialMediaReady.then(() => {
    if (visibleEmbeds.has(container) && !document.hidden && !slowConnection && !reducedMotion.matches) {
      loadEmbed(container);
    }
  });
};
const visibleObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      visibleEmbeds.add(entry.target);
      startVisibleEmbed(entry.target);
    } else visibleEmbeds.delete(entry.target);
  }
}, {threshold:0.1}) : null;
for (const embed of document.querySelectorAll('[data-embed]')) {
  embed.querySelector('button').addEventListener('click', () => loadEmbed(embed, true));
  if (visibleObserver) visibleObserver.observe(embed);
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) visibleEmbeds.forEach(startVisibleEmbed);
});

// The local loop has two encodings. Mobile/slow networks receive the smaller one.
for (const video of document.querySelectorAll('video[data-src]')) {
  const container = video.closest('.media');
  const toggle = container.querySelector('.video-toggle');
  let manuallyPaused = false;
  let inView = false;
  const prepare = () => {
    if (video.getAttribute('src')) return;
    video.src = matchMedia('(max-width:809.98px)').matches || slowConnection ? video.dataset.mobileSrc : video.dataset.src;
    video.preload = 'metadata';
    video.load();
  };
  const play = () => {
    prepare();
    if (video.error) video.load();
    video.play().then(() => { toggle.textContent = 'Пауза'; }).catch(() => {
      video.controls = true;
      toggle.textContent = 'Воспроизвести';
    });
  };
  video.addEventListener('loadeddata', () => container.classList.add('is-ready'));
  video.addEventListener('error', () => {
    video.controls = true;
    toggle.textContent = 'Повторить';
  });
  toggle.addEventListener('click', () => {
    if (!video.paused) { manuallyPaused = true; video.pause(); toggle.textContent = 'Воспроизвести'; }
    else { manuallyPaused = false; play(); }
  });
  const update = () => {
    if (inView && !document.hidden && !reducedMotion.matches && !slowConnection && !manuallyPaused) {
      initialMediaReady.then(() => {
        if (inView && !document.hidden && !reducedMotion.matches && !slowConnection && !manuallyPaused) play();
      });
    }
    else { video.pause(); toggle.textContent = 'Воспроизвести'; }
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { inView = entries[0].isIntersecting; update(); }, {threshold: .1}).observe(video);
  } else { video.controls = true; prepare(); }
  document.addEventListener('visibilitychange', update);
  reducedMotion.addEventListener('change', update);
}

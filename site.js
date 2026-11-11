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

// A failed AVIF/network request gets one independent WebP fallback, then a
// manual retry. Never loop requests when the connection is unavailable.
for (const img of document.querySelectorAll('img[data-fallback]')) {
  let triedFallback = false;
  let retry;
  const fallback = () => matchMedia('(max-width:809.98px)').matches
    ? img.dataset.mobileFallback : img.dataset.fallback;
  const failed = () => {
    if (!triedFallback) {
      triedFallback = true;
      img.closest('picture')?.querySelectorAll('source').forEach(source => source.remove());
      img.removeAttribute('srcset');
      img.src = fallback();
    } else if (!retry) {
      retry = document.createElement('button');
      retry.className = 'image-retry';
      retry.textContent = 'Загрузить изображение';
      retry.addEventListener('click', event => {
        event.preventDefault();
        img.src = `${fallback()}?retry=${Date.now()}`;
      });
      // Keep interactive controls outside the home card's link.
      (img.closest('figure') || img.parentElement).append(retry);
    }
  };
  img.addEventListener('error', failed);
  img.addEventListener('load', () => { retry?.remove(); retry = null; });
  if (img.complete && img.currentSrc && !img.naturalWidth) failed();
}

// Native MP4 playback avoids a separate external player for every animation.
// Warm only nearby videos; play visible ones and pause the rest.
const connection = navigator.connection;
const slowConnection = Boolean(connection?.saveData) || /(^|-)2g$/.test(connection?.effectiveType || '');
const players = new Map();
const nearbyObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) players.get(entry.target).prepare();
  }
}, {rootMargin:'400px 0px'}) : null;
const videoObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    const player = players.get(entry.target);
    player.inView = entry.isIntersecting && entry.intersectionRatio >= .1;
    player.update();
  }
}, {threshold:[0, .1]}) : null;

for (const video of document.querySelectorAll('video[data-src]')) {
  const container = video.closest('.media');
  const button = container.querySelector('.video-button');
  const label = container.querySelector('.video-label');
  const status = container.querySelector('.video-status');
  let manuallyPaused = false;
  let automaticPause = false;
  const player = {
    inView:false,
    prepare(userInitiated = false) {
      if (video.dataset.poster) {
        video.poster = video.dataset.poster;
        delete video.dataset.poster;
      }
      if (video.getAttribute('src') || (!userInitiated && (slowConnection || reducedMotion.matches))) return;
      video.controls = true;
      video.preload = 'metadata';
      video.src = matchMedia('(max-width:809.98px)').matches || slowConnection
        ? video.dataset.mobileSrc : video.dataset.src;
      video.load();
    },
    play() {
      player.prepare(true);
      if (video.error) video.load();
      status.textContent = 'Загрузка видео…';
      video.play().catch(() => {
        if (!video.error) status.textContent = '';
        // Low Power Mode and browser policies may require a tap.
        if (!video.error) label.textContent = 'Смотреть видео';
      });
    },
    update() {
      if (player.inView && !document.hidden && !reducedMotion.matches && !slowConnection && !manuallyPaused) {
        player.play();
      } else if (!video.paused) {
        automaticPause = true;
        video.pause();
      }
    },
  };
  video.addEventListener('playing', () => {
    manuallyPaused = false;
    status.textContent = '';
    container.classList.add('is-ready');
  });
  video.addEventListener('pause', () => {
    if (!automaticPause) manuallyPaused = true;
    automaticPause = false;
  });
  video.addEventListener('error', () => {
    container.classList.remove('is-ready');
    label.textContent = 'Повторить';
    status.textContent = 'Не удалось загрузить видео';
  });
  button.addEventListener('click', () => { manuallyPaused = false; player.play(); });
  players.set(video, player);
  if (nearbyObserver) nearbyObserver.observe(video);
  else if (video.dataset.poster) video.poster = video.dataset.poster;
  videoObserver?.observe(video);
}
document.addEventListener('visibilitychange', () => players.forEach(player => player.update()));
reducedMotion.addEventListener('change', () => players.forEach(player => player.update()));

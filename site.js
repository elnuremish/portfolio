// Create only nearby players. The provider handles adaptive streaming and pauses
// videos outside the viewport; no player code is requested on the home page.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const connection = navigator.connection;
const saveData = Boolean(connection?.saveData);
const slowConnection = saveData || /(^|-)2g$/.test(connection?.effectiveType || '');
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
const nearbyEmbeds = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    if (!slowConnection) loadEmbed(entry.target);
    nearbyEmbeds.unobserve(entry.target);
  }
}, {rootMargin: '400px 0px'}) : null;
for (const embed of document.querySelectorAll('[data-embed]')) {
  embed.querySelector('button').addEventListener('click', () => loadEmbed(embed, true));
  if (nearbyEmbeds) nearbyEmbeds.observe(embed);
  else if (!slowConnection) loadEmbed(embed);
}

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
    if (inView && !document.hidden && !reducedMotion.matches && !slowConnection && !manuallyPaused) play();
    else { video.pause(); toggle.textContent = 'Воспроизвести'; }
  };
  if ('IntersectionObserver' in window) {
    const prepareObserver = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      if (!slowConnection) prepare();
      prepareObserver.disconnect();
    }, {rootMargin: '500px 0px'});
    prepareObserver.observe(video);
    new IntersectionObserver(entries => { inView = entries[0].isIntersecting; update(); }, {threshold: .1}).observe(video);
  } else { video.controls = true; prepare(); }
  document.addEventListener('visibilitychange', update);
  reducedMotion.addEventListener('change', update);
}

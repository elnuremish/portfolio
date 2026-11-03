// Native browser navigation replaces the Framer application runtime.
// Videos keep playing only while visible, including after returning from another page.
const visibleVideos = new IntersectionObserver(entries => {
  for (const {target: video, isIntersecting} of entries) {
    if (isIntersecting && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.muted = true;
      video.play().catch(() => { video.controls = true; });
    } else video.pause();
  }
}, {threshold: 0.1});
document.querySelectorAll('video').forEach(video => {
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) video.controls = true;
  visibleVideos.observe(video);
});
document.querySelectorAll('iframe').forEach((frame, index) => {
  frame.title ||= `Видео проекта ${index + 1}`;
});

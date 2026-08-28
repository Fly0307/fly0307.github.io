import { createStars, shouldAnimate, type Star } from './motion-policy';

const mobileQuery = '(max-width: 760px)';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function initializeStarfield(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-starfield]');
  if (!canvas) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const reducedMotion = window.matchMedia(reducedMotionQuery);
  const mobile = window.matchMedia(mobileQuery);
  let inViewport = false;
  let frame: number | null = null;
  let stars: Star[] = [];
  let width = 0;
  let height = 0;

  const resize = (): void => {
    const bounds = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    stars = createStars(mobile.matches ? 32 : 70, width, height);
    draw(0);
  };

  const draw = (time: number): void => {
    context.clearRect(0, 0, width, height);
    stars.forEach((star, index) => {
      const shimmer = 0.78 + Math.sin(time / 1600 + index) * 0.22;
      context.beginPath();
      context.fillStyle = `rgba(244, 247, 251, ${star.alpha * shimmer})`;
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    });
  };

  const state = () => ({
    reducedMotion: reducedMotion.matches,
    documentVisible: document.visibilityState === 'visible',
    inViewport,
  });

  const stop = (): void => {
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
  };

  const render = (time: number): void => {
    frame = null;
    if (!shouldAnimate(state())) return;
    draw(time);
    frame = window.requestAnimationFrame(render);
  };

  const update = (): void => {
    if (shouldAnimate(state())) {
      if (frame === null) frame = window.requestAnimationFrame(render);
      return;
    }
    stop();
  };

  const observer = new IntersectionObserver(([entry]) => {
    inViewport = entry?.isIntersecting ?? false;
    update();
  });

  observer.observe(canvas);
  resize();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', update);
  reducedMotion.addEventListener('change', update);
  mobile.addEventListener('change', resize);
}

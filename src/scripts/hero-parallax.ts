import { clampProgress, shouldAnimate } from './motion-policy';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function initializeHeroParallax(): void {
  const hero = document.querySelector<HTMLElement>('[data-hero-parallax]');
  if (!hero) return;

  const reducedMotion = window.matchMedia(reducedMotionQuery);
  let inViewport = false;
  let frame: number | null = null;

  const state = () => ({
    reducedMotion: reducedMotion.matches,
    documentVisible: document.visibilityState === 'visible',
    inViewport,
  });

  const update = (): void => {
    frame = null;
    if (!shouldAnimate(state())) return;
    const bounds = hero.getBoundingClientRect();
    const shift = clampProgress(Math.max(0, -bounds.top) / Math.max(bounds.height, 1)) * 64;
    const scale = 1 + (shift / 64) * 0.06;
    hero.style.setProperty('--hero-shift', `${shift.toFixed(2)}px`);
    hero.style.setProperty('--hero-scale', scale.toFixed(3));
  };

  const requestUpdate = (): void => {
    if (!shouldAnimate(state()) || frame !== null) return;
    frame = window.requestAnimationFrame(update);
  };

  const updateMotionState = (): void => {
    if (!shouldAnimate(state())) {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
      return;
    }
    requestUpdate();
  };

  const observer = new IntersectionObserver(([entry]) => {
    inViewport = entry?.isIntersecting ?? false;
    if (!inViewport && frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
    updateMotionState();
  });

  observer.observe(hero);
  window.addEventListener('scroll', requestUpdate, { passive: true });
  document.addEventListener('visibilitychange', updateMotionState);
  reducedMotion.addEventListener('change', updateMotionState);
}

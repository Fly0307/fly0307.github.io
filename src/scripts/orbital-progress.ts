import { clampProgress } from './motion-policy';

export function initializeOrbitalProgress(): void {
  const progress = document.querySelector<HTMLElement>('[data-orbit-progress]');
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-orbit-section]'));
  if (!progress || sections.length === 0) return;

  const links = Array.from(progress.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  let frame: number | null = null;

  const update = (): void => {
    frame = null;
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const pageProgress = scrollRange > 0 ? clampProgress(window.scrollY / scrollRange) : 0;
    progress.style.setProperty('--page-progress', String(pageProgress));

    const nearest = sections.reduce((current, section) => {
      const currentDistance = Math.abs(current.getBoundingClientRect().top);
      const candidateDistance = Math.abs(section.getBoundingClientRect().top);
      return candidateDistance < currentDistance ? section : current;
    });
    const currentId = nearest.id;
    links.forEach((link) => {
      if (link.getAttribute('href') === `#${currentId}`) {
        link.setAttribute('aria-current', 'step');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const requestUpdate = (): void => {
    if (frame === null) frame = window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  requestUpdate();
}

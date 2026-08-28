const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function initializeSectionReveal(): void {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (sections.length === 0) return;

  const reducedMotion = window.matchMedia(reducedMotionQuery);
  let observer: IntersectionObserver | null = null;

  const showAll = (): void => {
    sections.forEach((section) => section.classList.add('is-visible'));
    observer?.disconnect();
    observer = null;
  };

  const setup = (): void => {
    if (reducedMotion.matches) {
      showAll();
      return;
    }
    if (!('IntersectionObserver' in window)) {
      showAll();
      return;
    }

    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer?.unobserve(entry.target);
      });
    }, { threshold: 0.15 });

    sections.forEach((section) => observer?.observe(section));
    document.documentElement.classList.add('motion-ready');
  };

  reducedMotion.addEventListener('change', setup);
  setup();
}

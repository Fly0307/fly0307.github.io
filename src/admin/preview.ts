import DOMPurify from 'dompurify';
import { marked } from 'marked';

export function renderPreview(target: HTMLElement, markdown: string, uploads: Map<string, string>): void {
  const html = marked.parse(markdown || '*正文预览会显示在这里。*', { async: false, gfm: true });
  const fragment = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'video', 'audio'],
    FORBID_ATTR: ['style', 'id', 'name'],
    RETURN_DOM_FRAGMENT: true,
  });
  fragment.querySelectorAll('a').forEach(link => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
  fragment.querySelectorAll('img').forEach(image => {
    const local = uploads.get(image.getAttribute('src') ?? '');
    if (local) image.src = local;
    image.referrerPolicy = 'no-referrer';
    image.loading = 'lazy';
  });
  target.replaceChildren(fragment);
}

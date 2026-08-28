export interface BlogCardData {
  language: 'zh' | 'en';
  tags: string[];
  year: string;
}

export interface BlogFilter {
  language?: string;
  tag?: string;
  year?: string;
}

export function matchesBlogFilter(card: BlogCardData, filter: BlogFilter): boolean {
  return (!filter.language || card.language === filter.language)
    && (!filter.tag || card.tags.includes(filter.tag))
    && (!filter.year || card.year === filter.year);
}

function readFilter(form: HTMLFormElement): BlogFilter {
  const data = new FormData(form);
  const valueFor = (name: keyof BlogFilter) => {
    const value = data.get(name);
    const control = form.elements.namedItem(name);
    return typeof value === 'string' && control instanceof HTMLSelectElement
      && [...control.options].some((option) => option.value === value)
      ? value
      : '';
  };

  return {
    language: valueFor('language'),
    tag: valueFor('tag'),
    year: valueFor('year'),
  };
}

function syncQuery(filter: BlogFilter): void {
  const params = new URLSearchParams();
  (['language', 'tag', 'year'] as const).forEach((key) => {
    if (filter[key]) params.set(key, filter[key]);
  });
  const query = params.toString();
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}`);
}

export function initializeBlogFilter(): void {
  const form = document.querySelector<HTMLFormElement>('[data-blog-filter]');
  if (!form) return;

  const cards = [...document.querySelectorAll<HTMLElement>('[data-blog-card]')];
  const empty = document.querySelector<HTMLElement>('[data-filter-empty]');
  const query = new URLSearchParams(location.search);

  (['language', 'tag', 'year'] as const).forEach((key) => {
    const value = query.get(key);
    const control = form.elements.namedItem(key);
    if (value && control instanceof HTMLSelectElement
      && [...control.options].some((option) => option.value === value)) {
      control.value = value;
    }
  });

  const apply = () => {
    const filter = readFilter(form);
    let visible = 0;

    cards.forEach((element) => {
      const card: BlogCardData = {
        language: element.dataset.language === 'en' ? 'en' : 'zh',
        tags: JSON.parse(element.dataset.tags ?? '[]') as string[],
        year: element.dataset.year ?? '',
      };
      element.hidden = !matchesBlogFilter(card, filter);
      if (!element.hidden) visible += 1;
    });

    if (empty) empty.hidden = cards.length === 0 || visible !== 0;
    syncQuery(filter);
  };

  form.addEventListener('change', apply);
  apply();
}

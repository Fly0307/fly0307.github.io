export type InterfaceLanguage = 'zh' | 'en';

export const languageStorageKey = 'unlearnedman-language';

export function resolveLanguage(
  storedLanguage: string | null,
  browserLanguage: string,
): InterfaceLanguage {
  if (storedLanguage === 'zh' || storedLanguage === 'en') return storedLanguage;
  return browserLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function nextLanguage(language: InterfaceLanguage): InterfaceLanguage {
  return language === 'zh' ? 'en' : 'zh';
}

export function resolveInterfaceLabel(
  language: InterfaceLanguage,
  chineseLabel: string | undefined,
  englishLabel: string | undefined,
): string {
  return language === 'zh' ? chineseLabel ?? '' : englishLabel ?? '';
}

export function applyInterfaceLanguage(language: InterfaceLanguage): void {
  document.documentElement.dataset.lang = language;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';

  const toggle = document.querySelector<HTMLButtonElement>('[data-language-toggle]');
  if (toggle) {
    toggle.textContent = language === 'zh' ? '切换至英文' : 'Switch to Chinese';
    toggle.ariaLabel = toggle.textContent;
  }

  document.querySelectorAll<HTMLImageElement>('[data-alt-zh][data-alt-en]').forEach((image) => {
    image.alt = language === 'zh' ? image.dataset.altZh ?? '' : image.dataset.altEn ?? '';
  });

  document.querySelectorAll<HTMLElement>('[data-aria-label-zh][data-aria-label-en]').forEach((element) => {
    element.setAttribute(
      'aria-label',
      resolveInterfaceLabel(language, element.dataset.ariaLabelZh, element.dataset.ariaLabelEn),
    );
  });
}

export function initializeLanguage(): void {
  let storedLanguage: string | null = null;

  try {
    storedLanguage = localStorage.getItem(languageStorageKey);
  } catch {
    storedLanguage = null;
  }

  applyInterfaceLanguage(resolveLanguage(storedLanguage, navigator.language));

  document.querySelector<HTMLButtonElement>('[data-language-toggle]')?.addEventListener('click', () => {
    const current = document.documentElement.dataset.lang === 'zh' ? 'zh' : 'en';
    const selectedLanguage = nextLanguage(current);

    applyInterfaceLanguage(selectedLanguage);

    try {
      localStorage.setItem(languageStorageKey, selectedLanguage);
    } catch {
      // The interface still updates if storage is unavailable.
    }
  });
}

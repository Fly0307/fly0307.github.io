const storageKey = 'unlearnedman-language';

export function resolveLanguage(storedLanguage, browserLanguage) {
  if (storedLanguage === 'zh') return 'zh';
  if (storedLanguage === 'en') return 'en';
  return String(browserLanguage || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function setLanguage(language) {
  const selectedLanguage = language === 'zh' ? 'zh' : 'en';
  if (typeof document === 'undefined') return selectedLanguage;

  document.documentElement.dataset.lang = selectedLanguage;
  document.documentElement.lang = selectedLanguage === 'zh' ? 'zh-CN' : 'en';
  const toggle = document.getElementById('language-toggle');
  if (toggle) {
    const isChinese = selectedLanguage === 'zh';
    const actionLabel = isChinese ? '切换至英文' : 'Switch to Chinese';
    toggle.textContent = actionLabel;
    toggle.setAttribute('aria-label', actionLabel);
    toggle.setAttribute('lang', isChinese ? 'zh-CN' : 'en');
  }

  const heroImage = document.getElementById('hero-image');
  if (heroImage) {
    heroImage.alt = selectedLanguage === 'zh' ? heroImage.dataset.altZh : heroImage.dataset.altEn;
  }

  try {
    localStorage.setItem(storageKey, selectedLanguage);
  } catch {
    // Privacy settings can make browser storage unavailable.
  }
  return selectedLanguage;
}

if (typeof document !== 'undefined') {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  let storedLanguage;
  try {
    storedLanguage = localStorage.getItem(storageKey);
  } catch {
    storedLanguage = null;
  }
  setLanguage(resolveLanguage(storedLanguage, navigator.language));
  document.getElementById('language-toggle')?.addEventListener('click', () => {
    setLanguage(document.documentElement.dataset.lang === 'zh' ? 'en' : 'zh');
  });
}

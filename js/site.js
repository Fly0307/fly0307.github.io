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
  const toggle = document.getElementById('language-toggle');
  if (toggle) {
    const isChinese = selectedLanguage === 'zh';
    toggle.textContent = isChinese ? 'English' : '中文';
    toggle.setAttribute('aria-label', isChinese ? 'Switch language to English' : '切换语言为中文');
    toggle.setAttribute('aria-pressed', String(isChinese));
  }

  try {
    localStorage.setItem(storageKey, selectedLanguage);
  } catch {
    // Privacy settings can make browser storage unavailable.
  }
  return selectedLanguage;
}

if (typeof document !== 'undefined') {
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

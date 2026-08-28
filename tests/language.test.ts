import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyInterfaceLanguage,
  initializeLanguage,
  nextLanguage,
  resolveLanguage,
} from '../src/scripts/language.ts';

class FakeButton {
  textContent = '';
  ariaLabel = '';
  private clickListener: (() => void) | undefined;

  addEventListener(type: string, listener: () => void) {
    if (type === 'click') this.clickListener = listener;
  }

  click() {
    this.clickListener?.();
  }
}

function installBrowserEnvironment(options: {
  storedLanguage?: string;
  browserLanguage?: string;
  getStorageThrows?: boolean;
  setStorageThrows?: boolean;
} = {}) {
  const button = new FakeButton();
  const image = {
    alt: '',
    dataset: {
      altZh: '白色火箭矗立在发射架旁，浅色地面上方是繁星点点的天空',
      altEn: 'A white rocket beside a launch structure on pale terrain beneath a starry sky',
    },
  };
  const values = new Map<string, string>();
  if (options.storedLanguage) values.set('unlearnedman-language', options.storedLanguage);

  const document = {
    documentElement: { dataset: {} as Record<string, string>, lang: '' },
    querySelector: () => button,
    querySelectorAll: () => [image],
  };
  const localStorage = {
    getItem(key: string) {
      if (options.getStorageThrows) throw new Error('storage unavailable');
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.setStorageThrows) throw new Error('storage unavailable');
      values.set(key, value);
    },
  };

  const originals = Object.fromEntries(
    ['document', 'localStorage', 'navigator'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );

  Object.defineProperties(globalThis, {
    document: { configurable: true, value: document },
    localStorage: { configurable: true, value: localStorage },
    navigator: { configurable: true, value: { language: options.browserLanguage ?? 'en-US' } },
  });

  return {
    button,
    document,
    image,
    values,
    restore() {
      for (const [name, descriptor] of Object.entries(originals)) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as Record<string, unknown>)[name];
      }
    },
  };
}

test('stored interface language wins over browser language', () => {
  assert.equal(resolveLanguage('zh', 'en-US'), 'zh');
  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
});

test('browser language is used when storage is absent or invalid', () => {
  assert.equal(resolveLanguage(null, 'zh-TW'), 'zh');
  assert.equal(resolveLanguage('invalid', 'en-GB'), 'en');
});

test('language toggle alternates between supported values', () => {
  assert.equal(nextLanguage('zh'), 'en');
  assert.equal(nextLanguage('en'), 'zh');
});

test('interface application updates labels, document language, and image alternatives', () => {
  const environment = installBrowserEnvironment();

  try {
    applyInterfaceLanguage('zh');
    assert.equal(environment.document.documentElement.dataset.lang, 'zh');
    assert.equal(environment.document.documentElement.lang, 'zh-CN');
    assert.equal(environment.button.textContent, '切换至英文');
    assert.equal(environment.button.ariaLabel, '切换至英文');
    assert.equal(environment.image.alt, environment.image.dataset.altZh);

    applyInterfaceLanguage('en');
    assert.equal(environment.document.documentElement.dataset.lang, 'en');
    assert.equal(environment.document.documentElement.lang, 'en');
    assert.equal(environment.button.textContent, 'Switch to Chinese');
    assert.equal(environment.image.alt, environment.image.dataset.altEn);
  } finally {
    environment.restore();
  }
});

test('initialization uses saved language and continues when storage fails', () => {
  const saved = installBrowserEnvironment({ storedLanguage: 'zh', browserLanguage: 'en-US' });

  try {
    initializeLanguage();
    assert.equal(saved.document.documentElement.dataset.lang, 'zh');
    saved.button.click();
    assert.equal(saved.document.documentElement.dataset.lang, 'en');
    assert.equal(saved.values.get('unlearnedman-language'), 'en');
  } finally {
    saved.restore();
  }

  const unavailable = installBrowserEnvironment({
    browserLanguage: 'zh-CN',
    getStorageThrows: true,
    setStorageThrows: true,
  });

  try {
    initializeLanguage();
    assert.equal(unavailable.document.documentElement.dataset.lang, 'zh');
    unavailable.button.click();
    assert.equal(unavailable.document.documentElement.dataset.lang, 'en');
  } finally {
    unavailable.restore();
  }
});

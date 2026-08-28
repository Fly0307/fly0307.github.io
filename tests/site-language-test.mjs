import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

class FakeButton {
  constructor() {
    this.textContent = '';
    this.attributes = new Map();
    this.listeners = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  click() {
    this.listeners.get('click')?.();
  }
}

function createFakeEnvironment(storedLanguage) {
  const button = new FakeButton();
  const heroImage = {
    alt: '',
    dataset: {
      altZh: '白色火箭矗立在发射架旁，浅色地面上方是繁星点点的天空',
      altEn: 'A white rocket beside a launch structure on pale terrain beneath a starry sky',
    },
  };
  const year = { textContent: '' };
  const values = new Map(storedLanguage ? [['unlearnedman-language', storedLanguage]] : []);
  return {
    button,
    heroImage,
    year,
    document: {
      documentElement: { dataset: {}, lang: '' },
      getElementById(id) {
        return {
          'language-toggle': button,
          'hero-image': heroImage,
          year,
        }[id] ?? null;
      },
    },
    localStorage: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      },
    },
  };
}

const originalDescriptors = Object.fromEntries(
  ['document', 'localStorage', 'navigator'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
);
const environment = createFakeEnvironment('zh');
Object.defineProperties(globalThis, {
  document: { configurable: true, value: environment.document },
  localStorage: { configurable: true, value: environment.localStorage },
  navigator: { configurable: true, value: { language: 'en-US' } },
});

try {
  const source = readFileSync(new URL('../js/site.js', import.meta.url), 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#test-${Date.now()}-${Math.random()}`;
  const { resolveLanguage, setLanguage } = await import(moduleUrl);

  assert.equal(resolveLanguage('zh', 'en-US'), 'zh');
  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
  assert.equal(resolveLanguage(null, 'zh-Hans-CN'), 'zh');
  assert.equal(resolveLanguage(null, 'fr-FR'), 'en');

  assert.equal(environment.document.documentElement.dataset.lang, 'zh');
  assert.equal(environment.document.documentElement.lang, 'zh-CN');
  assert.equal(environment.button.textContent, '切换至英文');
  assert.equal(environment.button.getAttribute('aria-label'), '切换至英文');
  assert.equal(environment.button.getAttribute('aria-pressed'), undefined);
  assert.equal(environment.heroImage.alt, '白色火箭矗立在发射架旁，浅色地面上方是繁星点点的天空');
  assert.equal(environment.localStorage.getItem('unlearnedman-language'), 'zh');
  assert.equal(environment.year.textContent, String(new Date().getFullYear()));

  environment.button.click();
  assert.equal(environment.document.documentElement.dataset.lang, 'en');
  assert.equal(environment.document.documentElement.lang, 'en');
  assert.equal(environment.button.textContent, 'Switch to Chinese');
  assert.equal(environment.button.getAttribute('aria-label'), 'Switch to Chinese');
  assert.equal(environment.button.getAttribute('aria-pressed'), undefined);
  assert.equal(environment.heroImage.alt, 'A white rocket beside a launch structure on pale terrain beneath a starry sky');
  assert.equal(environment.localStorage.getItem('unlearnedman-language'), 'en');

  setLanguage('zh');
  assert.equal(environment.document.documentElement.lang, 'zh-CN');
} finally {
  for (const [name, descriptor] of Object.entries(originalDescriptors)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

console.log('Language behavior checks passed.');

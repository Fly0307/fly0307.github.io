import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/site.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { resolveLanguage, setLanguage } = await import(moduleUrl);

class FakeButton {
  constructor() {
    this.textContent = '';
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }
}

function createFakeEnvironment() {
  const button = new FakeButton();
  const values = new Map();
  return {
    button,
    document: {
      documentElement: { dataset: {} },
      getElementById(id) {
        return id === 'language-toggle' ? button : null;
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

assert.equal(resolveLanguage('zh', 'en-US'), 'zh');
assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
assert.equal(resolveLanguage(null, 'zh-Hans-CN'), 'zh');
assert.equal(resolveLanguage(null, 'fr-FR'), 'en');

const previousDocument = globalThis.document;
const previousLocalStorage = globalThis.localStorage;
const environment = createFakeEnvironment();
globalThis.document = environment.document;
globalThis.localStorage = environment.localStorage;

try {
  setLanguage('zh');
  assert.equal(environment.document.documentElement.dataset.lang, 'zh');
  assert.equal(environment.button.textContent, 'English');
  assert.equal(environment.button.getAttribute('aria-label'), 'Switch language to English');
  assert.equal(environment.button.getAttribute('aria-pressed'), 'true');
  assert.equal(environment.localStorage.getItem('unlearnedman-language'), 'zh');

  setLanguage('en');
  assert.equal(environment.document.documentElement.dataset.lang, 'en');
  assert.equal(environment.button.textContent, '中文');
  assert.equal(environment.button.getAttribute('aria-label'), '切换语言为中文');
  assert.equal(environment.button.getAttribute('aria-pressed'), 'false');
  assert.equal(environment.localStorage.getItem('unlearnedman-language'), 'en');
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
  if (previousLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = previousLocalStorage;
}

console.log('Language behavior checks passed.');

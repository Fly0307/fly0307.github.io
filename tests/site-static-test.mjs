import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve('.');
const failures = [];

function displayPath(file) {
  return relative(root, file) || file;
}

function mustContain(file, text) {
  const contents = readFileSync(file, 'utf8');
  if (!contents.includes(text)) {
    throw new Error(`${displayPath(file)} is missing ${JSON.stringify(text)}`);
  }
}

function mustNotContain(file, text) {
  const contents = readFileSync(file, 'utf8');
  if (contents.includes(text)) {
    throw new Error(`${displayPath(file)} contains forbidden ${JSON.stringify(text)}`);
  }
}

function check(label, callback) {
  try {
    callback();
  } catch (error) {
    failures.push(`${label}: ${error.message}`);
  }
}

function walk(directory) {
  const files = [];
  const excludedDirectories = new Set([
    '.git',
    '.superpowers',
  ]);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.name !== '.DS_Store') files.push(path);
  }
  return files;
}

function isAllowedPublishedFile(file) {
  const path = displayPath(file);
  return [
    'README.md',
    '.nojekyll',
    'index.html',
    '404.html',
    'css/site.css',
    'js/site.js',
    'img/hero-space.png',
  ].includes(path) || path.startsWith('docs/') || path.startsWith('tests/');
}

const requiredFiles = [
  'index.html',
  '404.html',
  'css/site.css',
  'js/site.js',
  'img/hero-space.png',
  '.nojekyll',
].map((file) => resolve(root, file));

for (const file of requiredFiles) {
  check(`required file ${displayPath(file)}`, () => {
    if (!statSync(file).isFile()) {
      throw new Error(`${displayPath(file)} is not a regular file`);
    }
  });
}

const html = resolve(root, 'index.html');
for (const text of [
  'https://github.com/Fly0307/MobiAgent',
  'https://penglai-enclave.systems/',
  'mailto:fly0307@sjtu.edu.cn',
  'lang="zh-CN"',
  'lang="en"',
  '<main',
  'skip-link',
  'id="language-toggle"',
  'data-zh',
  'data-en',
  'aria-live="polite"',
]) {
  check(`index.html content`, () => mustContain(html, text));
}

for (const [file, text] of [
  [resolve(root, 'css/site.css'), 'prefers-reduced-motion'],
  [resolve(root, 'js/site.js'), 'localStorage'],
  [resolve(root, 'js/site.js'), 'export function resolveLanguage'],
  [resolve(root, 'js/site.js'), 'export function setLanguage'],
]) {
  check(`${displayPath(file)} content`, () => mustContain(file, text));
}

const publicFiles = walk(root).filter((file) => /\.(html|css|js)$/.test(file));
for (const file of publicFiles) {
  for (const text of [
    'Dominic',
    'Dunky-Z/comment',
    'clientSecret',
    'hm.baidu.com',
    'Gitalk',
    'Hexo',
  ]) {
    check(`${displayPath(file)} legacy content`, () => mustNotContain(file, text));
  }
}

for (const file of walk(root)) {
  check(`published file ${displayPath(file)}`, () => {
    if (!isAllowedPublishedFile(file)) {
      throw new Error(`${displayPath(file)} is not in the approved published file set`);
    }
  });
}

for (const directory of [
  '2020',
  '2021',
  '2022',
  'archives',
  'categories',
  'tags',
  'page',
  'links',
  'about',
]) {
  check(`legacy directory ${directory}`, () => {
    try {
      if (statSync(resolve(root, directory)).isDirectory()) {
        throw new Error(`${directory} still exists`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  });
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Static site checks passed.');
}

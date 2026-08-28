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
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
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
  check(`required file ${displayPath(file)}`, () => statSync(file));
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
]) {
  check(`index.html content`, () => mustContain(html, text));
}

for (const [file, text] of [
  [resolve(root, 'css/site.css'), 'prefers-reduced-motion'],
  [resolve(root, 'js/site.js'), 'localStorage'],
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
    if (statSync(resolve(root, directory)).isDirectory()) {
      throw new Error(`${directory} still exists`);
    }
  });
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Static site checks passed.');
}

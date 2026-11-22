import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';

const fromProject = (path) => new URL(path, import.meta.url);
const escapeHTML = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

async function directories(path) {
  return (await readdir(fromProject(path), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

const template = await readFile(fromProject('page.html'), 'utf8');
const groups = new Map();
const pages = [];
const levels = ['基础 · 单轮', '进阶 · 多轮', '高阶 · 综合运用'];
const categories = [];
const leveledRoots = ['python', 'codex'];
for (const root of leveledRoots) {
  for (const group of await directories(`content/${root}/`)) {
    const path = `content/${root}/` + encodeURIComponent(group) + '/';
    for (const name of await directories(path)) {
      categories.push({ group: group.slice(3), category: name.slice(3), path: path + encodeURIComponent(name) + '/', leveled: true });
    }
  }
}
for (const name of await directories('content/')) {
  if (!leveledRoots.includes(name)) {
    categories.push({ group: '日常工作', category: name, path: 'content/' + encodeURIComponent(name) + '/', leveled: false });
  }
}

function renderPage(title, content, script = '') {
  return template
    .replace('<!-- TITLE -->', () => title)
    .replace('<!-- SCRIPT -->', () => script)
    .replace('<!-- CONTENT -->', () => content);
}

function renderPrompt(prompt) {
  const [, ...parts] = prompt.split(/^### (第 \d+ 轮[^\n]*)\n+/m);
  if (!parts.length) return `<pre class="prompt-body" data-full-prompt>${escapeHTML(prompt)}</pre>`;
  const rounds = [];
  for (let i = 0; i < parts.length; i += 2) {
    const title = escapeHTML(parts[i]);
    rounds.push(`<section class="prompt-round">
      <div class="round-header">
        <h3>${title}</h3>
        <button class="button copy" type="button" data-copy="round" aria-label="复制${title}">复制本轮</button>
      </div>
      <pre class="prompt-body">${escapeHTML(parts[i + 1].trim())}</pre>
    </section>`);
  }
  return `<pre data-full-prompt hidden>${escapeHTML(prompt)}</pre>${rounds.join('\n')}`;
}

for (const { group, category, path, leveled } of categories) {
  const files = (await readdir(fromProject(path))).filter((file) => file.endsWith('.md')).sort();
  if (files.length === 0) continue;

  const cards = [];
  for (const file of files) {
    const raw = (await readFile(fromProject(path + encodeURIComponent(file)), 'utf8')).trim().replace(/\r\n/g, '\n');
    const entry = raw.match(/^# ([^\n]+)\n\n([^\n]+)\n\n(?:\[([^\]]+)\]\((https:\/\/[^\s)]+)\)\n\n)?## Prompt\n\n([\s\S]+)$/);
    if (!entry) throw new Error('提示词格式有误：' + path + file);
    const [, title, description, sourceLabel, source] = entry.map((part) => escapeHTML(part ?? ''));
    const prompt = entry[5];
    const copyLabel = /^### 第 \d+ 轮/m.test(prompt) ? '复制全套' : '复制';
    const level = leveled ? levels[Number(file.match(/^([123])-/)?.[1]) - 1] : undefined;
    if (leveled && !level) throw new Error('缺少层级文件名前缀：' + path + file);
    cards.push(`<article class="prompt">
  ${level ? `<div class="prompt-level">${level}</div>` : ''}
  <h2>${title}</h2>
  <p>${description}</p>
  <div class="prompt-actions">
    <button class="button" type="button" data-detail aria-label="查看详情：${title}">查看详情</button>
    <button class="button copy" type="button" data-copy aria-label="${copyLabel}：${title}">${copyLabel}</button>
  </div>
  <template>
    ${renderPrompt(prompt)}
    ${source ? `<a class="source" href="${source}">${sourceLabel}</a>` : ''}
  </template>
</article>`);
  }

  const label = escapeHTML(category);
  const filename = 'category-' + encodeURIComponent(category) + '.html';
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(`<a href="./${filename}"><span class="category-name">${label}</span><span>${cards.length} 条</span></a>`);
  pages.push([filename, renderPage(`${label} · 日常提示词库`, `<main class="container">
  <a class="back" href="./index.html">返回类别</a>
  <header class="intro">
    <h1>${label}</h1>
    <p>${cards.length} 条提示词</p>
  </header>
  ${cards.join('\n')}
</main>
<dialog class="detail-dialog" aria-labelledby="detail-title">
  <div class="detail-panel">
    <header class="detail-header">
      <h2 id="detail-title"></h2>
      <form method="dialog"><button class="button" type="submit" autofocus>关闭</button></form>
    </header>
    <div class="detail-content"></div>
    <footer class="detail-footer">
      <p class="detail-status" role="status"></p>
      <button class="button copy" type="button" data-copy>复制提示词</button>
    </footer>
  </div>
</dialog>
<div class="toast" role="status"></div>`, '<script src="./copy.js" defer></script>')]);
}

const navigation = [...groups].map(([group, links], index) => `<section class="category-group" aria-labelledby="group-${index}">
  <h2 id="group-${index}">${escapeHTML(group)}</h2>
  <nav class="categories" aria-labelledby="group-${index}">${links.join('\n')}</nav>
</section>`);

pages.push(['index.html', renderPage('日常提示词库', `<main class="container">
  <header class="intro">
    <h1>日常提示词库</h1>
    <p>Python 小工具、Codex 学习工程与日常工作提示词</p>
  </header>
  ${navigation.join('\n')}
</main>`)]);

await mkdir(fromProject('dist/'), { recursive: true });
await Promise.all([
  ...pages.map(([filename, page]) => writeFile(fromProject('dist/' + filename), page)),
  ...['site.css', 'copy.js'].map((file) => copyFile(fromProject(file), fromProject('dist/' + file))),
]);
console.log('dist/index.html');

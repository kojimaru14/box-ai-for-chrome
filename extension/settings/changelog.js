import { applyExtensionPageUi } from '../utils/dev-mode.js';

applyExtensionPageUi();

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text) {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function renderMarkdown(markdown) {
  const lines = escapeHtml(markdown.replace(/\r\n/g, '\n')).split('\n');
  const html = [];
  let inList = false;

  const flushList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith('### ')) {
      flushList();
      html.push(`<h3>${renderInline(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      flushList();
      html.push(`<h2>${renderInline(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      flushList();
      html.push(`<h1>${renderInline(line.slice(2))}</h1>`);
    } else if (line === '---' || line === '***') {
      flushList();
      html.push('<hr>');
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        html.push('<ul>');
        inList = true;
      }
      html.push(`<li>${renderInline(line.slice(2))}</li>`);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      html.push(`<p>${renderInline(line)}</p>`);
    }
  }
  flushList();
  return html.join('\n');
}

async function loadChangelog() {
  const el = document.getElementById('changelog-content');
  try {
    const response = await fetch(chrome.runtime.getURL('CHANGELOG.md'));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    el.innerHTML = renderMarkdown(await response.text());
  } catch (err) {
    console.error('Failed to load changelog', err);
    el.innerHTML = '<p class="changelog-error">Failed to load changelog.</p>';
  }
  applyExtensionPageUi();
}

loadChangelog();

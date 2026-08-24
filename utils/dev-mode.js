/**
 * Detects whether this extension is a development (unpacked) or store install,
 * and applies UI indicators accordingly.
 */
const STYLE_ID = 'box-ai-dev-mode-styles';
const OVERLAY_ID = 'box-ai-dev-mode-overlay';
const BANNER_ID = 'box-ai-dev-mode-banner';
const DEV_COLOR = '#e67e22';

export const isDevelopment = () => !('update_url' in chrome.runtime.getManifest());

export const getInfo = () => {
  const manifest = chrome.runtime.getManifest();
  const dev = isDevelopment();
  return {
    name: manifest.name,
    version: manifest.version,
    channel: dev ? 'development' : 'store',
    channelLabel: dev ? 'Development (unpacked)' : 'Chrome Web Store',
    isDevelopment: dev,
  };
};

const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .box-ai-dev-mode-banner {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 999;
      box-sizing: border-box;
      background-color: ${DEV_COLOR};
      color: white;
      padding: 6px 12px;
      font-size: 0.85em;
      font-weight: bold;
      text-align: center;
    }
    html.box-ai-dev-mode body {
      padding-top: calc(20px + 2.1em);
    }
    .box-ai-dev-mode-overlay {
      position: fixed;
      bottom: 8px;
      right: 8px;
      z-index: 2147483647;
      pointer-events: none;
      background-color: ${DEV_COLOR};
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 11px;
      font-weight: bold;
      padding: 4px 8px;
      border-radius: 4px;
      opacity: 0.92;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
    }
    .box-ai-dev-mode-popup-banner {
      background-color: ${DEV_COLOR};
      color: white;
      padding: 8px 10px;
      margin: -10px -10px 10px;
      font-size: 12px;
      line-height: 1.4;
      border-radius: 4px 4px 0 0;
    }
    .box-ai-dev-mode-popup-banner .channel {
      font-weight: bold;
    }
    .box-ai-dev-mode-popup-banner .version {
      font-weight: normal;
      opacity: 0.95;
    }
    .box-ai-dev-mode-store-info {
      color: #666;
      font-size: 11px;
      text-align: center;
      margin-bottom: 10px;
    }
    #box-ai-chat-header.box-ai-dev-mode-header {
      background: linear-gradient(90deg, ${DEV_COLOR}, #d35400) !important;
    }
    #box-ai-chat-header.box-ai-dev-mode-header span::after {
      content: " [DEV]";
      font-size: 0.85em;
      opacity: 0.95;
    }
  `;
  document.head.appendChild(style);
};

export const applyExtensionPageUi = () => {
  const info = getInfo();
  document.documentElement.classList.toggle('box-ai-dev-mode', info.isDevelopment);

  if (!info.isDevelopment) return;

  injectStyles();

  if (!document.getElementById(BANNER_ID)) {
    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'box-ai-dev-mode-banner';
    banner.textContent = `Development build (unpacked) — v${info.version}`;
    document.body.insertBefore(banner, document.body.firstChild);
  }
};

export const applyPopupUi = (container) => {
  const info = getInfo();
  if (!container) return;

  injectStyles();

  if (info.isDevelopment) {
    container.innerHTML = `
      <div class="box-ai-dev-mode-popup-banner">
        <div class="channel">Development Build</div>
        <div class="version">v${info.version} · unpacked install</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="box-ai-dev-mode-store-info">
        Chrome Web Store · v${info.version}
      </div>
    `;
  }
};

export const applyPageOverlay = () => {
  if (!isDevelopment() || window !== window.top) return;
  if (document.getElementById(OVERLAY_ID)) return;

  const mount = () => {
    if (document.getElementById(OVERLAY_ID)) return;
    if (!document.body) return;

    injectStyles();
    const info = getInfo();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'box-ai-dev-mode-overlay';
    overlay.textContent = `DEV · Box AI v${info.version}`;
    document.body.appendChild(overlay);
  };

  if (document.body) {
    mount();
  } else {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  }
};

export const applyChatHeaderIndicator = () => {
  if (!isDevelopment()) return;

  const apply = () => {
    const header = document.getElementById('box-ai-chat-header');
    if (!header) return false;
    injectStyles();
    header.classList.add('box-ai-dev-mode-header');
    return true;
  };

  if (apply()) return;

  const observer = new MutationObserver(() => {
    if (apply()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
};

export const applyToolbarIndicators = () => {
  const info = getInfo();
  if (info.isDevelopment) {
    chrome.action.setBadgeText({ text: 'DEV' });
    chrome.action.setBadgeBackgroundColor({ color: DEV_COLOR });
    chrome.action.setTitle({ title: `${info.name} [DEV] · v${info.version}` });
    console.log('[Box AI for Chrome] Development build (unpacked)');
    console.log(`version: ${info.version}`);
  } else {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: `${info.name} · v${info.version}` });
  }
};

const BoxAiDevMode = {
  isDevelopment,
  getInfo,
  applyExtensionPageUi,
  applyPopupUi,
  applyPageOverlay,
  applyChatHeaderIndicator,
  applyToolbarIndicators,
};

export default BoxAiDevMode;

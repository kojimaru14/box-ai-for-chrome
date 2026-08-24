/**
 * Dev/store build detection and UI for extension pages and the service worker.
 * Content-script indicators (page overlay, chat header) live in dev-mode-content.js.
 */
const STYLE_ID = 'box-ai-dev-mode-styles';
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
    isDevelopment: dev,
  };
};

export const formatVersion = (info) => `v${info.version}`;

export const formatTooltipTitle = (info) =>
  info.isDevelopment
    ? `${info.name} [DEV] · ${formatVersion(info)}`
    : `${info.name} · ${formatVersion(info)}`;

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
    .box-ai-version-info {
      color: #666;
      font-size: 12px;
      text-align: center;
    }
    .box-ai-version-info--popup {
      margin-bottom: 10px;
    }
    .box-ai-version-info--options {
      margin: -20px 0 24px;
    }
  `;
  document.head.appendChild(style);
};

export const applyExtensionPageUi = () => {
  const info = getInfo();
  document.documentElement.classList.toggle('box-ai-dev-mode', info.isDevelopment);

  injectStyles();

  if (info.isDevelopment) {
    if (!document.getElementById(BANNER_ID)) {
      const banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.className = 'box-ai-dev-mode-banner';
      banner.textContent = `Development build · ${formatVersion(info)}`;
      document.body.insertBefore(banner, document.body.firstChild);
    }
    return;
  }

  if (document.getElementById('box-ai-version-label')) return;
  const heading = document.querySelector('.container > h1');
  if (!heading) return;

  const label = document.createElement('p');
  label.id = 'box-ai-version-label';
  label.className = 'box-ai-version-info box-ai-version-info--options';
  label.textContent = formatVersion(info);
  heading.insertAdjacentElement('afterend', label);
};

export const applyPopupUi = (container) => {
  const info = getInfo();
  if (!container) return;

  injectStyles();

  if (info.isDevelopment) {
    container.innerHTML = `
      <div class="box-ai-dev-mode-popup-banner">
        <div class="channel">Development Build</div>
        <div class="version">${formatVersion(info)}</div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="box-ai-version-info box-ai-version-info--popup">${formatVersion(info)}</div>
    `;
  }
};

export const applyToolbarIndicators = () => {
  const info = getInfo();
  chrome.action.setTitle({ title: formatTooltipTitle(info) });

  if (info.isDevelopment) {
    chrome.action.setBadgeText({ text: 'DEV' });
    chrome.action.setBadgeBackgroundColor({ color: DEV_COLOR });
    console.log('[Box AI for Chrome] Development build (unpacked)');
    console.log(`version: ${info.version}`);
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
};

const BoxAiDevMode = {
  isDevelopment,
  getInfo,
  formatVersion,
  formatTooltipTitle,
  applyExtensionPageUi,
  applyPopupUi,
  applyToolbarIndicators,
};

export default BoxAiDevMode;

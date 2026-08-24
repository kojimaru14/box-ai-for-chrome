/**
 * Classic content-script helper for development build indicators.
 * Kept separate from utils/dev-mode.js (ES module) so content scripts
 * do not require "type": "module" in manifest.json.
 */
const BoxAiDevModeContent = (function() {
  const STYLE_ID = 'box-ai-dev-mode-styles';
  const OVERLAY_ID = 'box-ai-dev-mode-overlay';
  const DEV_COLOR = '#e67e22';

  const isDevelopment = () => !('update_url' in chrome.runtime.getManifest());

  const getInfo = () => {
    const manifest = chrome.runtime.getManifest();
    return {
      version: manifest.version,
      isDevelopment: isDevelopment(),
    };
  };

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
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
    `;
    document.head.appendChild(style);
  };

  const applyPageOverlay = () => {
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

  const applyChatHeaderIndicator = () => {
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

  applyPageOverlay();

  return { applyChatHeaderIndicator };
})();

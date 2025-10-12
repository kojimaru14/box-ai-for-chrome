function isExtensionContextValid() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
}

document.getElementById('optionsBtn').addEventListener('click', () => {
  if (isExtensionContextValid()) {
    chrome.runtime.openOptionsPage();
  } else {
    console.warn("Extension context invalidated. Cannot open options page.");
  }
});

document.getElementById('clearCacheBtn').addEventListener('click', async () => {
    chrome.runtime.sendMessage({ type: 'clear_cache' });
    alert('Cache clearing process initiated.');
});

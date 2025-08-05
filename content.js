// Inject the chat UI
fetch(chrome.runtime.getURL('chat/chat.html'))
  .then(response => response.text())
  .then(data => {
    // Use insertAdjacentHTML to avoid breaking the page's existing event listeners.
    document.body.insertAdjacentHTML('beforeend', data);
  });

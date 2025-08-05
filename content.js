// Inject the chat UI
fetch(chrome.runtime.getURL('chat/chat.html'))
  .then(response => response.text())
  .then(data => {
    document.body.innerHTML += data;
  });

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_chat") {
    const chatContainer = document.getElementById('box-ai-chat-container');
    if (chatContainer) {
      chatContainer.style.display = 'flex';
    }
  }
});

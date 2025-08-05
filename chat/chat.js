// This script is injected into the page and controls the chat UI.
// It runs after the main document is loaded, but we still need to wait for our specific HTML to be injected.

const setupChatUI = () => {
  const chatContainer = document.getElementById('box-ai-chat-container');
  // If the container isn't on the page yet, wait and try again.
  if (!chatContainer) {
    setTimeout(setupChatUI, 100); // Check again in 100ms
    return;
  }

  const header = document.getElementById('box-ai-chat-header');
  const dockButton = document.getElementById('box-ai-dock-button');
  const closeButton = document.getElementById('box-ai-close-button');
  const sendButton = document.getElementById('box-ai-send-button');
  const input = document.getElementById('box-ai-chat-input');
  const messagesContainer = document.getElementById('box-ai-chat-messages');

  // --- Dragging Logic ---
  let isDragging = false;
  let offset = { x: 0, y: 0 };

  header.addEventListener('mousedown', (e) => {
    if (chatContainer.classList.contains('box-ai-docked')) return;
    isDragging = true;
    offset.x = e.clientX - chatContainer.offsetLeft;
    offset.y = e.clientY - chatContainer.offsetTop;
    chatContainer.style.cursor = 'move';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    chatContainer.style.left = `${e.clientX - offset.x}px`;
    chatContainer.style.top = `${e.clientY - offset.y}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    chatContainer.style.cursor = 'default';
  });

  // --- Action Buttons ---
  dockButton.addEventListener('click', () => {
    chatContainer.classList.toggle('box-ai-docked');
    if (chatContainer.classList.contains('box-ai-docked')) {
      chatContainer.style.left = '';
      chatContainer.style.top = '';
      dockButton.textContent = '❐';
      dockButton.title = 'Undock';
    } else {
      dockButton.textContent = '–';
      dockButton.title = 'Dock to side';
    }
  });

  closeButton.addEventListener('click', () => {
    chatContainer.style.display = 'none';
  });

  // --- Messaging Logic ---
  const sendMessage = () => {
    const message = input.value.trim();
    if (message) {
      displayMessage(message, 'user');
      chrome.runtime.sendMessage({ action: 'send_chat_message', message });
      input.value = '';
    }
  };

  const displayMessage = (message, sender) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${sender}-message`);
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  sendButton.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // --- Global Listeners ---
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'receive_chat_message') {
      displayMessage(request.message, 'assistant');
    } else if (request.action === "open_chat") {
      chatContainer.style.display = 'flex';
    }
  });
};

// Start the setup process. If the document is already loaded, it will run.
// If not, it will wait for the DOMContentLoaded event.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupChatUI);
} else {
  setupChatUI();
}

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
  const minimizeButton = document.getElementById('box-ai-minimize-button');
  const sendButton = document.getElementById('box-ai-send-button');
  const input = document.getElementById('box-ai-chat-input');
  const messagesContainer = document.getElementById('box-ai-chat-messages');

  // Initialize in minimized state
  chatContainer.classList.add('box-ai-minimized');
  minimizeButton.textContent = ''; // Hide text when minimized
  minimizeButton.title = 'Maximize';
  // chatContainer.style.display = 'flex'; // Make it visible after minimizing
  // ↑ Uncomment this line if you want the chat icon to be visible by default.

  let thinkingMessageElement = null;
  
  // --- Dragging Logic ---
  let isDragging = false;
  let offset = { x: 0, y: 0 };

  header.addEventListener('mousedown', (e) => {
    if (chatContainer.classList.contains('box-ai-docked') || chatContainer.classList.contains('box-ai-minimized')) return;
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

  minimizeButton.addEventListener('click', (e) => {
    // Stop propagation to prevent header click listener from firing
    e.stopPropagation(); 
    if (chatContainer.classList.contains('box-ai-docked')) {
      chatContainer.classList.remove('box-ai-docked');
      dockButton.textContent = '–';
      dockButton.title = 'Dock to side';
    }
    chatContainer.classList.toggle('box-ai-minimized');
    if (chatContainer.classList.contains('box-ai-minimized')) {
      minimizeButton.textContent = ''; // Hide text when minimized
      minimizeButton.title = 'Maximize';
      chatContainer.style.left = ''; // Clear inline left style
      chatContainer.style.top = '';  // Clear inline top style
    } else {
      minimizeButton.textContent = '_'; // Show text when maximized
      minimizeButton.title = 'Minimize';
    }
  });

  // --- Helper for Copy Button ---
  const createCopyButton = (message) => {
    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = '📋'; // Clipboard emoji
    copyButton.title = 'Copy to clipboard';
    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(message).then(() => {
        copyButton.textContent = '✅';
        chrome.runtime.sendMessage({ type: "displayBanner", message: "Copied to clipboard!", bannerType: "success" });
        setTimeout(() => { copyButton.textContent = '📋'; }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        chrome.runtime.sendMessage({ type: "displayBanner", message: "Failed to copy!", bannerType: "error" });
      });
    });
    return copyButton;
  };
  // New: Handle click on header to maximize when minimized
  header.addEventListener('click', () => {
    if (chatContainer.classList.contains('box-ai-minimized')) {
      chatContainer.classList.remove('box-ai-minimized');
      minimizeButton.textContent = '_'; // Restore minimize icon
      minimizeButton.title = 'Minimize';
    }
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

  const displayMessage = (message, sender, isThinking = false) => {
    // If there's a thinking message and this is a final assistant message,
    // update the existing thinking message instead of creating a new one.
    if (thinkingMessageElement && sender === 'assistant' && !isThinking) {
      thinkingMessageElement.querySelector('span').textContent = message;
      thinkingMessageElement.classList.remove('thinking');
      // Re-add copy button if it was a thinking message that got updated
      thinkingMessageElement.appendChild(createCopyButton(message));
      thinkingMessageElement = null; // Clear the reference
      messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom
      return;
    }

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${sender}-message`);

    const messageText = document.createElement('span');
    messageText.textContent = message;
    messageElement.appendChild(messageText);

    if (isThinking) {
      messageElement.classList.add('thinking');
      thinkingMessageElement = messageElement;
    } else if (sender === 'assistant') {
      messageElement.appendChild(createCopyButton(message));
    }

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

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in chat.js:', request);
    switch (request.action) {
      case 'open_chat_with_thinking_indicator':
        messagesContainer.innerHTML = ''; // Clear previous messages
        displayMessage(request.instruction, 'user');
        displayMessage('Thinking...', 'assistant', true);
        chatContainer.classList.remove('box-ai-minimized'); // Maximize the window
        minimizeButton.textContent = '_'; // Restore minimize icon
        minimizeButton.title = 'Minimize';
        chatContainer.style.display = 'flex';
        break;
      case 'receive_chat_message':
        displayMessage(request.message, 'assistant');
        break;
      case 'open_chat':
        chatContainer.classList.remove('box-ai-minimized'); // Maximize the window
        minimizeButton.textContent = '_'; // Restore minimize icon
        minimizeButton.title = 'Minimize';
        chatContainer.style.display = 'flex';
        break;
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
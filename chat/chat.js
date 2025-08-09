const { createSvgIcon, icons } = window.BoxExtensionIcons;

/**
 * Creates a "Copy to Clipboard" button for a message.
 * @param {string} message - The text to be copied.
 * @returns {HTMLButtonElement} The copy button element.
 */
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

/**
 * Initializes the entire chat UI and its functionalities.
 */
const setupChatUI = () => {
  const chatContainer = document.getElementById('box-ai-chat-container');
  if (!chatContainer) {
    setTimeout(setupChatUI, 100); // Retry if the container isn't ready
    return;
  }

  // --- DOM Elements ---
  const header = document.getElementById('box-ai-chat-header');
  const dockButton = document.getElementById('box-ai-dock-button');
  const closeButton = document.getElementById('box-ai-close-button');
  const minimizeButton = document.getElementById('box-ai-minimize-button');
  const sendButton = document.getElementById('box-ai-send-button');
  const input = document.getElementById('box-ai-chat-input');
  const messagesContainer = document.getElementById('box-ai-chat-messages');

  // --- State ---
  let isDragging = false;
  let offset = { x: 0, y: 0 };
  let thinkingMessageElement = null;

  

  // --- UI Update Functions ---

  /**
   * Sets the minimized state of the chat window.
   * @param {boolean} minimized - True to minimize, false to maximize.
   */
  const setMinimized = (minimized) => {
    if (minimized) {
      // If docked, undock first before minimizing
      if (chatContainer.classList.contains('box-ai-docked')) {
        chatContainer.classList.remove('box-ai-docked');
        dockButton.innerHTML = '';
        dockButton.appendChild(createSvgIcon(icons.dock));
        dockButton.title = 'Dock to side';
      }
      chatContainer.classList.add('box-ai-minimized');
      minimizeButton.title = 'Maximize';
      // Reset position when minimizing
      chatContainer.style.left = '';
      chatContainer.style.top = '';
    } else {
      chatContainer.classList.remove('box-ai-minimized');
      minimizeButton.title = 'Minimize';
    }
  };

  /**
   * Toggles the docked state of the chat window.
   */
  const toggleDock = () => {
    // Cannot dock if minimized
    if (chatContainer.classList.contains('box-ai-minimized')) return;

    const isDocked = chatContainer.classList.toggle('box-ai-docked');
    dockButton.innerHTML = ''; // Clear existing icon
    if (isDocked) {
      // Reset position when docking
      chatContainer.style.left = '';
      chatContainer.style.top = '';
      dockButton.appendChild(createSvgIcon(icons.undock));
      dockButton.title = 'Undock';
    } else {
      dockButton.appendChild(createSvgIcon(icons.dock));
      dockButton.title = 'Dock to side';
    }
  };

  /**
   * Displays a message in the chat window.
   * @param {string} message - The message content.
   * @param {string} sender - 'user' or 'assistant'.
   * @param {boolean} isThinking - If true, displays a thinking indicator.
   */
  const displayMessage = (message, sender, isThinking = false) => {
    // If updating a "thinking" message to a final one
    if (thinkingMessageElement && sender === 'assistant' && !isThinking) {
      thinkingMessageElement.querySelector('span').textContent = message;
      thinkingMessageElement.classList.remove('thinking');
      thinkingMessageElement.appendChild(createCopyButton(message));
      thinkingMessageElement = null; // Clear reference
    } else {
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
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  // --- Event Handlers ---

  const handleSendMessage = () => {
    const message = input.value.trim();
    if (message) {
      displayMessage(message, 'user');
      chrome.runtime.sendMessage({ type: 'send_chat_message', message });
      input.value = '';
    }
  };

  // --- Event Listeners Setup ---

  // Dragging Logic
  header.addEventListener('mousedown', (e) => {
    if (chatContainer.classList.contains('box-ai-docked') || chatContainer.classList.contains('box-ai-minimized')) return;
    isDragging = true;
    offset = {
      x: e.clientX - chatContainer.offsetLeft,
      y: e.clientY - chatContainer.offsetTop,
    };
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

  // Action Buttons & Input
  dockButton.addEventListener('click', toggleDock);

  closeButton.addEventListener('click', () => {
    chatContainer.style.display = 'none';
    chrome.runtime.sendMessage({ type: 'chat_closed' });
  });

  minimizeButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent header click event
    setMinimized(!chatContainer.classList.contains('box-ai-minimized'));
  });

  // Maximize when clicking the header of a minimized chat
  header.addEventListener('click', () => {
    if (chatContainer.classList.contains('box-ai-minimized')) {
      setMinimized(false); // Maximize
    }
  });

  sendButton.addEventListener('click', handleSendMessage);

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  // Chrome Runtime Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in chat.js:', request);
    switch (request.type) {
      case 'open_chat_with_thinking_indicator':
        messagesContainer.innerHTML = ''; // Clear previous messages
        displayMessage(request.instruction, 'user');
        displayMessage('Thinking...', 'assistant', true);
        setMinimized(false); // Maximize
        chatContainer.style.display = 'flex';
        break;
      case 'receive_chat_message':
        displayMessage(request.message, 'assistant');
        break;
      case 'open_chat':
        setMinimized(false); // Maximize
        chatContainer.style.display = 'flex';
        break;
    }
  });

  // --- Initial State ---
  setMinimized(true); // Initialize as minimized
  // To make the chat icon visible by default, you might need to set
  // chatContainer.style.display = 'flex';
};

// --- Entry Point ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupChatUI);
} else {
  setupChatUI();
}

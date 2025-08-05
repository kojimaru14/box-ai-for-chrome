document.addEventListener('DOMContentLoaded', () => {
  const chatContainer = document.getElementById('box-ai-chat-container');
  const header = document.getElementById('box-ai-chat-header');
  const dockButton = document.getElementById('box-ai-dock-button');
  const closeButton = document.getElementById('box-ai-close-button');
  const sendButton = document.getElementById('box-ai-send-button');
  const input = document.getElementById('box-ai-chat-input');

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
      // Reset position when docking
      chatContainer.style.left = '';
      chatContainer.style.top = '';
      dockButton.textContent = '❐'; // Change icon to 'undock'
      dockButton.title = 'Undock';
    } else {
      dockButton.textContent = '–'; // Change icon back to 'dock'
      dockButton.title = 'Dock to side';
    }
  });

  closeButton.addEventListener('click', () => {
    chatContainer.style.display = 'none';
  });

  sendButton.addEventListener('click', () => {
    // Placeholder for sending a message
    const message = input.value.trim();
    if (message) {
      console.log('Sending message:', message);
      input.value = '';
    }
  });
});

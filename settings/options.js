import { BOX__CLIENT_ID, BOX__CLIENT_SECRET, defaultCustomInstructions } from './config.js';
import BOX from '../box.js';
import { displayBanner } from './banner.js';
import './box-ui-elements/picker.js';

// Load available AI models for selection
let models = [];
async function loadModels() {
  const response = await fetch('models.json');
  const edges = await response.json();
  models = edges.map(edge => edge.node);
}

const boxClient = new BOX({ BOX__CLIENT_ID, BOX__CLIENT_SECRET });
const { FolderPicker } = Box;

async function loginBoxOAuth() {
    const clientId = BOX__CLIENT_ID;
    const clientSecret = BOX__CLIENT_SECRET;
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = `https://account.box.com/api/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectedTo) => {
        const params = new URLSearchParams(new URL(redirectedTo).search);
        const code = params.get('code');
        await boxClient.getTokensAuthorizationCodeGrant(code, clientId, clientSecret, redirectUri);
        const userInfo = await boxClient.getUser();
        document.getElementById('status').textContent = `Logged in as ${userInfo.name} (${userInfo.login})`;
        await initializeFolderPicker();
    });
}

const folderPicker = new FolderPicker({
    container: '.picker',
});

// Attach event listener for when the choose button is pressed
folderPicker.addListener('choose', function(items) {
    const folder = items[0];
    document.getElementById('selected-folder').textContent = `Selected Folder: ${folder.name} (ID: ${folder.id})`;
    chrome.storage.local.set({ BOX__DESTINATION_FOLDER_ID: { id: folder.id, name: folder.name } });
});

async function initializeFolderPicker() {
    const token = await boxClient.getBoxAccessToken();
    const pickerButton = document.querySelector('.picker button');
    if (!token) {
        if (pickerButton) pickerButton.disabled = true;
        return;
    }
    if (pickerButton) pickerButton.disabled = false;
    folderPicker.show("0", token, {
        container: '.picker',
        maxSelectable: 1,
        canSetShareAccess: false,
        size: 'small',
        chooseButtonLabel: 'Select',
        cancelButtonLabel: 'Cancel',
        modal: {
            buttonLabel: 'Folder Picker',
            buttonClassName: ''
        }
    });
}

(async () => {
    const token = await boxClient.getBoxAccessToken();
    if (token) {
        try {
            const userInfo = await boxClient.getUser();
            document.getElementById('status').textContent =
                `Logged in as ${userInfo.name} (${userInfo.login})`;
        } catch (e) {
            console.error(e);
        }
    }
    const { BOX__DESTINATION_FOLDER_ID: destinationFolder } = await chrome.storage.local.get('BOX__DESTINATION_FOLDER_ID');
    if (destinationFolder) {
        document.getElementById('selected-folder').textContent =
            `Selected Folder: ${destinationFolder.name} (ID: ${destinationFolder.id})`;
    }
    await initializeFolderPicker();
})();

document.getElementById('BTN__BOX_LOGIN').addEventListener('click', loginBoxOAuth);

// Initialize 'Delete after copy' cleanup setting
{
  const checkbox = document.getElementById('BOX__DELETE_FILE_AFTER_COPY');
  (async () => {
    const { BOX__DELETE_FILE_AFTER_COPY: deleteAfterCopy = false } =
      await chrome.storage.local.get({ BOX__DELETE_FILE_AFTER_COPY: false });
    checkbox.checked = deleteAfterCopy;
  })();
  checkbox.addEventListener('change', async (e) => {
    await chrome.storage.local.set({ BOX__DELETE_FILE_AFTER_COPY: e.target.checked });
    const status = document.getElementById('cleanup-status');
    status.textContent = 'Cleanup setting saved.';
    setTimeout(() => { status.textContent = ''; }, 3000);
  });
}

// State for current custom instructions and editing
let currentItems = [];
let editingItemId = null;
// Stores the system prompt template for the model selected in the modal
// Stores the system prompt template for the model selected in the modal
let modalModelConfig = '';
// Stores the previously-selected model in the modal (for revert on failure)
let modalPreviousModel = '';

// Load models then initialize custom instructions UI
(async () => {
  await loadModels();
  initCustomInstructions();
})();
document.getElementById('add-instruction').addEventListener('click', () => openEditModal());
document.getElementById('save-instructions').addEventListener('click', onSaveInstructions);

// Modal event handlers
document.getElementById('modal-save').addEventListener('click', onModalSave);
document.getElementById('modal-cancel').addEventListener('click', closeModal);

/**
 * Load and render custom instructions from storage.
 */
async function initCustomInstructions() {
  const { BOX__CUSTOM_INSTRUCTIONS: stored = [] } = await chrome.storage.local.get({ BOX__CUSTOM_INSTRUCTIONS: [] });
  const items = stored.length > 0 ? stored : defaultCustomInstructions;
  currentItems = items.slice();
  renderInstructionsTable(currentItems);
}

/**
 * Render custom instructions table rows.
 * @param {Array} items
 */
function renderInstructionsTable(items) {
  const tbody = document.querySelector('#custom-instructions-table tbody');
  tbody.innerHTML = '';
  items.forEach(item => {
    tbody.appendChild(createInstructionRow(item));
  });
}

/** Truncate a string to a maximum length, adding an ellipsis if needed */
function truncateText(str, maxChars = 170) {
  if (typeof str !== 'string') return str;
  return str.length > maxChars ? str.slice(0, maxChars) + '…' : str;
}

/**
 * Create a table row for a custom instruction.
 * @param {Object} item
 */
function createInstructionRow(item) {
  const tr = document.createElement('tr');
  tr.dataset.id = item.id;

  const titleTd = document.createElement('td');
  titleTd.textContent = truncateText(item.title);
  titleTd.title = item.title;

  const instrTd = document.createElement('td');
  instrTd.textContent = truncateText(item.instruction);
  instrTd.title = item.instruction;

  const modelTd = document.createElement('td');
  const modelName = item.model
    ? (models.find(m => m.id === item.model)?.uiName || item.model)
    : 'Default';
  modelTd.textContent = modelName;
  modelTd.title = modelName;

  const orderTd = document.createElement('td');
  orderTd.textContent = item.sortOrder;

  const actionsTd = document.createElement('td');
  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.addEventListener('click', () => openEditModal(item.id));
  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => {
    currentItems = currentItems.filter(i => i.id !== item.id);
    renderInstructionsTable(currentItems);
  });
  actionsTd.appendChild(editButton);
  actionsTd.appendChild(removeButton);

  tr.appendChild(titleTd);
  tr.appendChild(instrTd);
  tr.appendChild(modelTd);
  tr.appendChild(orderTd);
  tr.appendChild(actionsTd);
  return tr;
}

/**
 * Open the modal to add a new or edit existing instruction.
 * @param {string} [id]
 */
function openEditModal(id) {
  editingItemId = id || crypto.randomUUID();
  const isNew = !id;
  document.getElementById('modal-title-label').textContent = isNew ? 'New Instruction' : 'Edit Instruction';
  const item = currentItems.find(i => i.id === id) || { id: editingItemId, title: '', instruction: '', sortOrder: 0, model: '', modelConfig: '' };
  modalModelConfig = item.modelConfig || '';
  // Initialize previous model for potential revert on failure
  modalPreviousModel = item.model || '';
  document.getElementById('modal-title').value = item.title;
  document.getElementById('modal-instruction').value = item.instruction;
  document.getElementById('modal-sortOrder').value = item.sortOrder;
  // Populate model select options
  const modelSelect = document.getElementById('modal-model');
  modelSelect.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Default';
  modelSelect.appendChild(defaultOption);
  models.forEach(m => {
    if (m.supportedPurposes.includes('CHAT')) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.uiName;
      if (m.id === item.model) opt.selected = true;
      modelSelect.appendChild(opt);
    }
  });
  modelSelect.value = item.model;
  const saveBtn = document.getElementById('modal-save');
  // Ensure OK button is enabled when modal opens
  saveBtn.disabled = false;
  modelSelect.onchange = async e => {
    const selectedModel = e.target.value;
    // Disable OK until prompt-template load completes
    saveBtn.disabled = true;
    if (selectedModel) {
      try {
        modalModelConfig = await boxClient.getAiAgentDefaultConfig(selectedModel) || '';
        // On success, update previousModel reference
        modalPreviousModel = selectedModel;
      } catch (err) {
        console.error(`Failed to load prompt template for model ${selectedModel}`, err);
        displayBanner(`Failed to load prompt template for model ${selectedModel}.`, 'error');
        modalModelConfig = '';
        // Revert dropdown to prior selection
        modelSelect.value = modalPreviousModel;
      }
    } else {
      modalModelConfig = '';
      modalPreviousModel = '';
    }
    saveBtn.disabled = false;
  };
  document.getElementById('instruction-modal').classList.remove('hidden');
}

/**
 * Persist all instructions to storage.
 */
async function onSaveInstructions() {
  try {
    await chrome.storage.local.set({ BOX__CUSTOM_INSTRUCTIONS: currentItems });
    displayBanner('Instructions saved.', 'success');
    const status = document.getElementById('instructions-status');
    status.textContent = 'Instructions saved.';
    setTimeout(() => { status.textContent = ''; }, 3000);
  } catch (err) {
    console.error('Failed to save instructions', err);
    displayBanner('Failed to save instructions.', 'error');
  }
}

/**
 * Save or add an instruction from the modal.
 */
async function onModalSave() {
  const title = document.getElementById('modal-title').value.trim();
  const instruction = document.getElementById('modal-instruction').value.trim();
  const sortOrder = parseInt(document.getElementById('modal-sortOrder').value, 10) || 0;
  const model = document.getElementById('modal-model').value;
  const existingIndex = currentItems.findIndex(i => i.id === editingItemId);
  const item = { id: editingItemId, title, instruction, sortOrder, model, modelConfig: modalModelConfig };
  if (existingIndex >= 0) {
    currentItems[existingIndex] = item;
  } else {
    currentItems.push(item);
  }
  try {
    await chrome.storage.local.set({ BOX__CUSTOM_INSTRUCTIONS: currentItems });
    displayBanner('Instructions saved.', 'success');
    const status = document.getElementById('instructions-status');
    status.textContent = 'Instructions saved.';
    setTimeout(() => { status.textContent = ''; }, 3000);
  } catch (err) {
    console.error('Failed to save instructions', err);
    displayBanner('Failed to save instructions.', 'error');
  }
  renderInstructionsTable(currentItems);
  closeModal();
}

/**
 * Close the edit modal.
 */
function closeModal() {
  document.getElementById('instruction-modal').classList.add('hidden');
  editingItemId = null;
}
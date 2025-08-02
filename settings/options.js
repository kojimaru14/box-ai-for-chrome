import { defaultCustomInstructions } from './config.js';
import BOX from '../utils/box.js';
import { displayBanner } from '../utils/banner.js';
import '../vendor/box-ui-elements/picker.js';

// Load available AI models for selection
let models = [];
async function loadModels() {
  const response = await fetch('models.json');
  const edges = await response.json();
  models = edges.map(edge => edge.node);
}

const boxClient = new BOX();
const { FolderPicker } = Box;

async function loginBoxOAuth() {
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = boxClient.getAuthorizeURL(redirectUri);
    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectedTo) => {
        const params = new URLSearchParams(new URL(redirectedTo).search);
        const code = params.get('code');
        await boxClient.getTokensAuthorizationCodeGrant(code, redirectUri);
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
    displayBanner('Cleanup setting saved.', 'success');
  });
}

// State for current custom instructions and editing
let currentItems = [];
let editingItemId = null;
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

// Modal event handlers
document.getElementById('modal-save').addEventListener('click', onModalSave);
document.getElementById('modal-cancel').addEventListener('click', closeModal);

/**
 * Load and render custom instructions from storage.
 */
async function initCustomInstructions() {
  const { BOX__CUSTOM_INSTRUCTIONS: stored = [] } = await chrome.storage.local.get({ BOX__CUSTOM_INSTRUCTIONS: [] });
  // Normalize language (default to English) on load
  const source = stored.length > 0 ? stored : defaultCustomInstructions;
  const items = source.map(item => ({ ...item, language: item.language || 'en', enabled: item.enabled === false ? false : true }));
  currentItems = items;
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

function createSvgIcon(paths) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'currentColor');

    paths.forEach(pathData => {
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', pathData);
        svg.appendChild(path);
    });

    return svg;
}

function confirmAndDelete(item) {
    const confirmModal = document.getElementById('confirm-modal');
    confirmModal.classList.remove('hidden');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');

    const onConfirm = async () => {
      currentItems = currentItems.filter(i => i.id !== item.id);
      await chrome.storage.local.set({ BOX__CUSTOM_INSTRUCTIONS: currentItems });
      displayBanner('Instruction removed.', 'success');
      renderInstructionsTable(currentItems);
      cleanup();
    };

    const onCancel = () => {
      cleanup();
    };

    function cleanup() {
        confirmModal.classList.add('hidden');
        confirmDeleteBtn.removeEventListener('click', onConfirm);
        cancelDeleteBtn.removeEventListener('click', onCancel);
    }

    confirmDeleteBtn.addEventListener('click', onConfirm);
    cancelDeleteBtn.addEventListener('click', onCancel);
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

  const langTd = document.createElement('td');
  const langName = item.language === 'ja' ? 'Japanese' : 'English';
  langTd.textContent = langName;
  langTd.title = langName;
  const orderTd = document.createElement('td');
  orderTd.textContent = item.sortOrder;

  const enabledTd = document.createElement('td');
  const enabledCb = document.createElement('input');
  enabledCb.type = 'checkbox';
  enabledCb.checked = item.enabled;
  enabledCb.addEventListener('change', async (e) => {
      const id = e.target.closest('tr').dataset.id;
      const currentItem = currentItems.find(i => i.id === id);
      currentItem.enabled = e.target.checked;
      await chrome.storage.local.set({ BOX__CUSTOM_INSTRUCTIONS: currentItems });
      displayBanner(`Instruction ${e.target.checked ? 'enabled' : 'disabled'}`, 'success');
  });
  enabledTd.appendChild(enabledCb);

  const actionsTd = document.createElement('td');

  const editButton = document.createElement('button');
  editButton.type = 'button';
  editButton.title = 'Edit';
  const editIcon = createSvgIcon(['m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001m-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708z']);
  editButton.appendChild(editIcon);
  editButton.addEventListener('click', () => openEditModal(item.id));

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.title = 'Delete';
  const removeIcon = createSvgIcon([
      'M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z',
      'M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z'
  ]);
  removeButton.appendChild(removeIcon);
  removeButton.addEventListener('click', () => confirmAndDelete(item));

  actionsTd.appendChild(editButton);
  actionsTd.appendChild(removeButton);

  tr.appendChild(enabledTd);
  tr.appendChild(titleTd);
  tr.appendChild(instrTd);
  tr.appendChild(modelTd);
  tr.appendChild(langTd);
  tr.appendChild(orderTd);
  tr.appendChild(actionsTd);
  return tr;
}

/**
 * Open the modal to add a new or edit existing instruction.
 * @param {string} [id]
 */
async function openEditModal(id) {
  editingItemId = id || crypto.randomUUID();
  const isNew = !id;
  document.getElementById('modal-title-label').textContent = isNew ? 'New Instruction' : 'Edit Instruction';
  const item = currentItems.find(i => i.id === id) || { id: editingItemId, title: '', instruction: '', sortOrder: 0, model: '', modelConfig: '', enabled: true };
  modalModelConfig = item.modelConfig || '';
  // Initialize previous model for potential revert on failure
  modalPreviousModel = item.model || '';
  document.getElementById('modal-title').value = item.title;
  document.getElementById('modal-instruction').value = item.instruction;
  document.getElementById('modal-sortOrder').value = item.sortOrder;
  document.getElementById('modal-enabled').checked = item.enabled;
  document.getElementById('modal-modelConfig').value = modalModelConfig ? JSON.stringify(modalModelConfig, undefined, 4) : '';
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
  modelSelect.value = item.model || '';
  document.getElementById('modal-language').value = item.language || 'en';
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = false;
  document.getElementById('instruction-modal').classList.remove('hidden');
}

async function updateModelConfig(modelId, language) {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  try {
    displayBanner(`Fetching model config for ${modelId}.`, 'info');
    modalModelConfig = await boxClient.getAiAgentDefaultConfig(modelId, language) || '';
    displayBanner(`Model config for ${modelId} fetched`, 'success');
  } catch (err) {
    console.error(`Failed to load prompt template for model ${modelId}`, err);
    displayBanner(`Failed to load prompt template for model ${modelId}.`, 'error');
    // Revert to previous model on failure
    document.getElementById('modal-model').value = modalPreviousModel;
  }
  modalPreviousModel = document.getElementById('modal-model').value;
  document.getElementById('modal-modelConfig').value = modalModelConfig ? JSON.stringify(modalModelConfig, undefined, 4) : '';
  saveBtn.disabled = false;
}

async function getModalConfig(model, language, modelConfig) {
    const saveBtn = document.getElementById('modal-save');
    if (modelConfig) {
        try {
            return JSON.parse(modelConfig);
        } catch (err) {
            displayBanner(`Invalid JSON in Model Config field`, 'error');
            saveBtn.disabled = false;
            return null;
        }
    }
    // If both model and language are default, then set modalModelConfig empty (which means default AI agent is used for AI query)
    if (!model && language === 'en') {
        return '';
    }
    // If modelConfig is empty although model is selected, then fetch the default config for that model
    try {
        displayBanner(`Fetching model config for ${model ? model : "Default"}.`, 'info');
        return await boxClient.getAiAgentDefaultConfig(model, language) || '';
    } catch (err) {
        console.error(`Failed to load prompt template for model ${model}`, err);
        displayBanner(`Failed to load prompt template for model ${model}.`, 'error');
        saveBtn.disabled = false;
        return null;
    }
}

/**
 * Save or add an instruction from the modal.
 */
async function onModalSave() {
  const saveBtn = document.getElementById('modal-save');
  saveBtn.disabled = true;
  const title = document.getElementById('modal-title').value.trim();
  const instruction = document.getElementById('modal-instruction').value.trim();
  const sortOrder = parseInt(document.getElementById('modal-sortOrder').value, 10) || 0;
  const model = document.getElementById('modal-model').value;
  const language = document.getElementById('modal-language').value;
  const enabled = document.getElementById('modal-enabled').checked;
  const modelConfigValue = document.getElementById('modal-modelConfig').value;
  console.log(`Saving instruction for model: ${model}, language: ${language}`);

  const modelConfig = await getModalConfig(model, language, modelConfigValue);

  if (modelConfig === null) {
      saveBtn.disabled = false;
      return;
  }
  modalModelConfig = modelConfig;

  const existingIndex = currentItems.findIndex(i => i.id === editingItemId);
  const item = { id: editingItemId, title, instruction, sortOrder, model, language, enabled, modelConfig: modalModelConfig };
  if (existingIndex >= 0) {
    currentItems[existingIndex] = item;
  } else {
    currentItems.push(item);
  }
  try {
    await chrome.storage.local.set({ BOX__CUSTOM_INSTRUCTIONS: currentItems });
    displayBanner('Instruction saved.', 'success');
  } catch (err) {
    console.error('Failed to save instruction', err);
    displayBanner('Failed to save instruction.', 'error');
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

var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

// When the model selection changes, update the prompt template
document.getElementById('modal-model').addEventListener('change', async (e) => {
  const modelId = e.target.value;
  const language = document.getElementById('modal-language').value;
  await updateModelConfig(modelId, language);
});

document.getElementById('modal-language').addEventListener('change', async (e) => {
  const language = e.target.value;
  const modelId = document.getElementById('modal-model').value;
  await updateModelConfig(modelId, language);
});

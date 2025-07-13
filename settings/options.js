import { BOX__CLIENT_ID, BOX__CLIENT_SECRET, defaultCustomInstructions } from './config.js';
import BOX from '../box.js';
import './box-ui-elements/picker.js';

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

// Initialize custom instructions UI
initCustomInstructions();
document.getElementById('add-instruction').addEventListener('click', onAddInstruction);
document.getElementById('save-instructions').addEventListener('click', onSaveInstructions);

/**
 * Load and render custom instructions from storage.
 */
async function initCustomInstructions() {
  const { BOX__CUSTOM_INSTRUCTIONS: stored = [] } = await chrome.storage.local.get({ BOX__CUSTOM_INSTRUCTIONS: [] });
  const items = stored.length > 0 ? stored : defaultCustomInstructions;
  renderInstructionsTable(items);
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

/**
 * Create a table row for a custom instruction.
 * @param {Object} item
 */
function createInstructionRow(item) {
  const id = item.id || crypto.randomUUID();
  const tr = document.createElement('tr');
  tr.dataset.id = id;

  const titleTd = document.createElement('td');
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = item.title || '';
  titleTd.appendChild(titleInput);

  const instrTd = document.createElement('td');
  const instrTextarea = document.createElement('textarea');
  instrTextarea.rows = 2;
  instrTextarea.value = item.instruction || '';
  instrTd.appendChild(instrTextarea);

  const orderTd = document.createElement('td');
  const orderInput = document.createElement('input');
  orderInput.type = 'number';
  orderInput.min = 0;
  orderInput.value = item.sortOrder || 0;
  orderTd.appendChild(orderInput);

  const actionsTd = document.createElement('td');
  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.textContent = 'Remove';
  removeButton.addEventListener('click', () => tr.remove());
  actionsTd.appendChild(removeButton);

  tr.appendChild(titleTd);
  tr.appendChild(instrTd);
  tr.appendChild(orderTd);
  tr.appendChild(actionsTd);
  return tr;
}

/**
 * Handler to add a new empty instruction row.
 */
function onAddInstruction() {
  const newItem = { id: crypto.randomUUID(), title: '', instruction: '', sortOrder: 0 };
  const tbody = document.querySelector('#custom-instructions-table tbody');
  tbody.appendChild(createInstructionRow(newItem));
}

/**
 * Handler to save all instructions to storage.
 */
async function onSaveInstructions() {
  const rows = Array.from(document.querySelectorAll('#custom-instructions-table tbody tr'));
  const items = rows.map(tr => ({
    id: tr.dataset.id,
    title: tr.querySelector('td:nth-child(1) input').value.trim(),
    instruction: tr.querySelector('td:nth-child(2) textarea').value.trim(),
    sortOrder: parseInt(tr.querySelector('td:nth-child(3) input').value, 10) || 0,
  }));
  await chrome.storage.local.set({ BOX__CUSTOM_INSTRUCTIONS: items });
  const status = document.getElementById('instructions-status');
  status.textContent = 'Instructions saved.';
  setTimeout(() => { status.textContent = ''; }, 3000);
}
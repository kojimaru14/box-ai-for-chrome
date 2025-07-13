import { BOX__CLIENT_ID, BOX__CLIENT_SECRET } from './config.js';
import BOX from '../box.js';

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
    });
}


const folderPicker = new FolderPicker({
    container: '.picker',
});

// Attach event listener for when the choose button is pressed
folderPicker.addListener('choose', function(items) {
    const folder = items[0];
    document.getElementById('selected-folder').textContent =
        `Selected Folder: ${folder.name} (ID: ${folder.id})`;
    chrome.storage.local.set({ defaultFolder: { id: folder.id, name: folder.name } });
});

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
    const { defaultFolder } = await chrome.storage.local.get('defaultFolder');
    if (defaultFolder) {
        if (typeof defaultFolder === 'string') {
            document.getElementById('selected-folder').textContent =
                `Selected Folder ID: ${defaultFolder}`;
        } else {
            document.getElementById('selected-folder').textContent =
                `Selected Folder: ${defaultFolder.name} (ID: ${defaultFolder.id})`;
        }
    }
})();

// Show the file picker
folderPicker.show("0", await boxClient.getBoxAccessToken(), {
    container: '.picker',
    maxSelectable: 1,
    canSetShareAccess: false,
    size: 'small',
    chooseButtonLabel: 'Select',
    cancelButtonLabel: 'Cancel',
    modal: {
        buttonLabel: 'Folder Picker'
    }
});

document.getElementById('BTN__BOX_LOGIN').addEventListener('click', loginBoxOAuth);

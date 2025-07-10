import { BOX__CLIENT_ID, BOX__CLIENT_SECRET } from './config.js';
import BOX from '../box.js';

console.log("BOX__CLIENT_ID:", BOX__CLIENT_ID);
console.log("BOX__CLIENT_SECRET:", BOX__CLIENT_SECRET);

// function saveOptions() {
//   const defaultFolder = document.getElementById('defaultFolder').value;
//   chrome.storage.sync.set({
//     defaultFolder: defaultFolder
//   }, function() {
//     const status = document.getElementById('status');
//     status.textContent = 'Options saved.';
//     setTimeout(function() {
//       status.textContent = '';
//     }, 750);
//   });
// }

// function restoreOptions() {
//   chrome.storage.sync.get({
//     defaultFolder: ''
//   }, function(items) {
//     document.getElementById('defaultFolder').value = items.defaultFolder;
//   });
// }

// document.addEventListener('DOMContentLoaded', restoreOptions);

async function loginBoxOAuth() {
    // const { BOX_CLIENT_ID: clientId, BOX_CLIENT_SECRET: clientSecret } = await chrome.storage.local.get(['BOX__CLIENT_ID', 'BOX__CLIENT_SECRET']);
    const boxClient = new BOX( { BOX__CLIENT_ID, BOX__CLIENT_SECRET });
    const clientId = BOX__CLIENT_ID;
    const clientSecret = BOX__CLIENT_SECRET;
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = `https://account.box.com/api/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    chrome.identity.launchWebAuthFlow({url: authUrl, interactive: true}, async (redirectedTo) => {
        const params = new URLSearchParams(new URL(redirectedTo).search);
        const code = params.get('code');
        await boxClient.getTokensAuthorizationCodeGrant(code, clientId, clientSecret, redirectUri);
        const userInfo = await boxClient.getUser();
        document.getElementById('BOX_LOGIN_STATUS').textContent = `Logged in as ${userInfo.name} (${userInfo.login})`;
    });
}
document.getElementById('BTN__BOX_LOGIN').addEventListener('click', loginBoxOAuth);
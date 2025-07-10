// const BOX__CLIENT_ID = import.meta.env.CLIENT_ID;
// const BOX__CLIENT_SECRET = import.meta.env.CLIENT_SECRET;
// console.log("BOX__CLIENT_ID:", BOX__CLIENT_ID);
// console.log("BOX__CLIENT_SECRET:", BOX__CLIENT_SECRET);

fetch(chrome.runtime.getURL('config.json'))
  .then((res) => res.json())
  .then((config) => {
    console.log('Loaded from config.json:', config);
    // Now use config.clientId or config.clientSecret
  })
  .catch(err => {
    console.error('Failed to load config.json', err);
  });

function saveOptions() {
  const defaultFolder = document.getElementById('defaultFolder').value;
  chrome.storage.sync.set({
    defaultFolder: defaultFolder
  }, function() {
    const status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

function restoreOptions() {
  chrome.storage.sync.get({
    defaultFolder: ''
  }, function(items) {
    document.getElementById('defaultFolder').value = items.defaultFolder;
  });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);

async function loginBoxOAuth() {
    // const { BOX_CLIENT_ID: clientId, BOX_CLIENT_SECRET: clientSecret } = await chrome.storage.local.get(['BOX__CLIENT_ID', 'BOX__CLIENT_SECRET']);
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

document.querySelectorAll("button").forEach(btn => {
    const id = btn.id;
    if(id.match(/^BTN__/) && id !== "BTN__BOX_LOGIN") {
        btn.addEventListener("click", async (e) => {
            const fieldId = id.replace(/^BTN__/, "");
            const fieldValue = document.getElementById(fieldId).value;
            const fieldName = btn.dataset.name;

            await chrome.storage.local.set({[fieldId]: fieldValue});
            
            _PMSG.showPopupMessage(`${fieldName} is updated with '${fieldValue}'`, 
                {"background-color": "cadetblue", 
                    height: "30px",
                    width: "600px",
                    "padding-left": "45px",
                    "padding-top": "18px"},
                2500);
        });
    }
});
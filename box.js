const CLIENT_ID = '6ekdr4ktl9i9bv1imcf6hcn9blcg1ynz';
const CLIENT_SECRET = 'dm8QFqppSLXXpHvcSJgUtudpvgzIIMUW';
const REDIRECT_URI = chrome.identity.getRedirectURL();

async function getBoxAccessToken() {
  const tokens = await loadTokens();

  if (tokens && Date.now() < tokens.expires_at) {
    return tokens.access_token; // 有効期限内
  } else if (tokens && tokens.refresh_token) {
    try {
      return await refreshAccessToken(tokens.refresh_token);
    } catch (e) {
      console.warn("リフレッシュ失敗、再ログインします:", e);
    }
  }

  // 初回ログイン
  const authCode = await getAuthorizationCode();
  return await exchangeCodeForToken(authCode);
}

function getAuthorizationCode() {
  return new Promise((resolve, reject) => {
    const authUrl = `https://account.box.com/api/oauth2/authorize?` +
      `response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (redirectUri) => {
      if (chrome.runtime.lastError || !redirectUri) {
        reject(chrome.runtime.lastError || new Error("認証失敗"));
        return;
      }

      const url = new URL(redirectUri);
      const code = url.searchParams.get('code');
      if (!code) return reject(new Error("codeが見つかりません"));
      resolve(code);
    });
  });
}

async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI
  });

  const res = await fetch("https://api.box.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  await saveTokens(data);
  return data.access_token;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  });

  const res = await fetch("https://api.box.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  await saveTokens(data);
  return data.access_token;
}

async function saveTokens(data) {
  const expiresAt = Date.now() + data.expires_in * 1000;
  await chrome.storage.local.set({
    box_tokens: {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt
    }
  });
}

async function loadTokens() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['box_tokens'], (result) => {
      resolve(result.box_tokens);
    });
  });
}


// async function uploadToBox(file, accessToken) {
//   const formData = new FormData();
//   formData.append('attributes', JSON.stringify({ name: file.name, parent: { id: "0" } }));
//   formData.append('file', file);

//   const response = await fetch('https://upload.box.com/api/2.0/files/content', {
//     method: 'POST',
//     headers: {
//       Authorization: `Bearer ${accessToken}`
//     },
//     body: formData
//   });

//   if (!response.ok) {
//     const errText = await response.text();
//     throw new Error(`Boxアップロードエラー: ${errText}`);
//   }
// }

// ...（前半は前回のトークン管理のまま）
async function uploadToBox(fileName, fileContent, folderId = "0") {
  const accessToken = await getBoxAccessToken();
  const file = new Blob([fileContent], { type: "text/markdown" });

  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    const name = attempt === 0 ? fileName : renameFile(fileName, attempt);
    const formData = new FormData();
    formData.append("attributes", JSON.stringify({
      name,
      parent: { id: folderId }
    }));
    formData.append("file", file);

    const response = await fetch("https://upload.box.com/api/2.0/files/content", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: formData
    });

    const result = await response.json();

    if (response.status === 201) {
      const fileId = result.entries[0].id;
      const sharedLink = await createSharedLink(fileId, accessToken);
      await navigator.clipboard.writeText(sharedLink);
      alert("✅ アップロード＆共有リンク取得成功\nリンクをコピーしました！");
      return;
    } else if (response.status === 409) {
      attempt++;
    } else {
      throw new Error("アップロード失敗: " + await response.text());
    }
  }

  throw new Error("最大リネーム回数を超えました。アップロードできませんでした。");
}


function renameFile(original, attempt) {
  const extIndex = original.lastIndexOf(".");
  if (extIndex === -1) {
    return `${original} (${attempt})`;
  }
  const base = original.slice(0, extIndex);
  const ext = original.slice(extIndex);
  return `${base} (${attempt})${ext}`;
}

async function logoutBox() {
  await chrome.storage.local.remove("box_tokens");
  console.log("🔓 Boxトークンを削除しました（ログアウト）");
}


async function createSharedLink(fileId, accessToken) {
  const response = await fetch(`https://api.box.com/2.0/files/${fileId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      shared_link: { access: "open" }
    })
  });

  const data = await response.json();
  return data.shared_link.url;
}

async function getBoxFolders(parentId = "0") {
  const accessToken = await getBoxAccessToken();
  const res = await fetch(`https://api.box.com/2.0/folders/${parentId}/items`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return data.entries.filter(item => item.type === "folder");
}

async function uploadBlobToBox(fileName, blob, folderId = "0") {
  const accessToken = await getBoxAccessToken();
  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    const name = attempt === 0 ? fileName : renameFile(fileName, attempt);
    const formData = new FormData();
    formData.append("attributes", JSON.stringify({
      name: fileName,
      parent: { id: folderId }
    }));
    formData.append("file", blob);

    const response = await fetch("https://upload.box.com/api/2.0/files/content", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: formData
    });

    const result = await response.json();

    if (response.status === 201) {
      const fileId = result.entries[0].id;
      const sharedLink = await createSharedLink(fileId, accessToken);
      await navigator.clipboard.writeText(sharedLink);
      alert("✅ アップロード＆共有リンク取得成功\nリンクをコピーしました！");
      return;
    } else if (response.status === 409) {
      attempt++;
    } else {
      throw new Error("アップロード失敗: " + await response.text());
    }
  }

  throw new Error("最大リネーム回数を超えました。アップロードできませんでした。");
}

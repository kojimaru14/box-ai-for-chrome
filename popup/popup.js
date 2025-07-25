function isExtensionContextValid() {
  return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
}

document.getElementById('optionsBtn').addEventListener('click', () => {
  if (isExtensionContextValid()) {
    chrome.runtime.openOptionsPage();
  } else {
    console.warn("Extension context invalidated. Cannot open options page.");
  }
});

/*
async function getSelectedContentWithImages() {
  const selection = window.getSelection();
  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const container = document.createElement("div");

  if (range) {
    container.appendChild(range.cloneContents());
  }

  const text = selection.toString();
  const imgSrcs = [...container.querySelectorAll("img")].map(img => img.src);

  return { text, imgSrcs };
}

async function fetchImageAsBlob(url) {
  const response = await fetch(url);
  return await response.blob();
}

async function uploadImageAndGetSharedLink(blob, fileName, folderId = "0") {
  const accessToken = await getBoxAccessToken();

  // アップロード
  const formData = new FormData();
  formData.append("attributes", JSON.stringify({
    name: fileName,
    parent: { id: folderId }
  }));
  formData.append("file", blob);

  const uploadRes = await fetch("https://upload.box.com/api/2.0/files/content", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData
  });

  const uploadJson = await uploadRes.json();
  const fileId = uploadJson.entries[0].id;

  // 共有リンク作成
  const sharedRes = await fetch(`https://api.box.com/2.0/files/${fileId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ shared_link: { access: "open" } })
  });

  const sharedJson = await sharedRes.json();
  return sharedJson.shared_link.download_url;
}

async function uploadSelectionToBox(folderId = "0") {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: getSelectedContentWithImages
  });

  const { text, imgSrcs } = result;
  let markdown = `# 選択されたメモ\n\n${text}\n`;

  for (let i = 0; i < imgSrcs.length; i++) {
    try {
      const blob = await fetchImageAsBlob(imgSrcs[i]);
      const fileName = `image_${Date.now()}_${i + 1}.png`;
      const imageUrl = await uploadImageAndGetSharedLink(blob, fileName, folderId);
      markdown += `\n\n![image_${i + 1}](${imageUrl})`;
    } catch (err) {
      console.warn("画像のアップロード失敗:", imgSrcs[i], err);
    }
  }

  // Markdownファイルとしてアップロード
  const blob = new Blob([markdown], { type: "text/markdown" });
  const finalFileName = `note_with_images_${Date.now()}.md`;
  await uploadBlobToBox(finalFileName, blob, folderId);

  alert("✅ テキスト＋画像をBoxにアップロードしました！");
}


document.getElementById('uploadBtn').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result: selectedText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString()
    });

    const formattedText = formatAsMarkdown(selectedText);

    // 🔽 ユーザーが選択したフォルダIDを取得
    const selectedFolderId = document.getElementById('folderSelect').value || "0"; // 未選択なら root

    const fileName = "note.md";
    // await uploadToBox(fileName, formattedText, selectedFolderId);
    await uploadSelectionToBox(selectedFolderId);

  } catch (err) {
    console.error(err);
    alert("アップロード中にエラーが発生しました。");
  }
});


// document.getElementById('uploadBtn').addEventListener('click', async () => {
//   try {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//     const [{ result: selectedText }] = await chrome.scripting.executeScript({
//       target: { tabId: tab.id },
//       func: () => window.getSelection().toString()
//     });

//     const fileName = "note.md";
//     // await uploadToBox(fileName, selectedText);
//     const formattedText = formatAsMarkdown(selectedText);
//     await uploadToBox(fileName, formattedText, selectedFolderId);
//     alert("アップロード成功！");
//   } catch (err) {
//     console.error(err);
//     alert("アップロード中にエラーが発生しました。");
//   }
// });

function formatAsMarkdown(text) {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return "";

  const title = lines[0].replace(/^#+/, '').trim();
  const body = lines.slice(1).join("\n").trim();

  return `# ${title}\n\n${body}`;
}


document.getElementById('logoutBtn').addEventListener('click', async () => {
  await logoutBox();
  alert("ログアウトしました");
});

document.addEventListener("DOMContentLoaded", async () => {
  const select = document.getElementById('folderSelect');
  const folders = await getBoxFolders(); // ルートフォルダ配下を取得

  folders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.name;
    select.appendChild(option);
  });
});
*/
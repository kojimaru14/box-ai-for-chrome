import BOX from './box.js';
import { BOX__CLIENT_ID, BOX__CLIENT_SECRET } from './settings/config.js';

const boxClient = new BOX( { BOX__CLIENT_ID, BOX__CLIENT_SECRET });

const aiQuery = `
This is a file that is a transcript of a Zendesk support ticket. It contains internal comments which are mostly investigation notes.
You are a support engineer assistant for Box.com. Your task is to generate a Jira bug ticket based on this file. Extract all relevant technical information, write a clear and concise summary, and fill in the appropriate fields using the template below. Use bullet points where needed. If any information is missing, note that clearly.
Please be sure to write in English, even if the original ticket is in another language (such as Japanese).

Summary: [Concise technical title under 100 characters]  
Environment:
- Product/Service: [e.g., Dashboard, API, Mobile App]
- Version: [If known]
- Browser/OS/Device: [If applicable]

Description:
Customer reported the following issue:

"[Insert customer description in quotes or summarized]"

Steps to reproduce:
1. [Step 1]
2. [Step 2]
3. ...

Expected result:
- [What was expected to happen]

Actual result:
- [What actually happened]

Error logs / screenshots (if any):
- [Error messages or logs]

Additional Notes:
- Ticket URL: [Insert support ticket link or ID]
- Internal findings or observations:
  - [Summarize any internal investigation or notes]
  
Labels: bug, support, customer_reported, [any additional labels]
Linked Support Ticket: [Insert ticket link or ID]
`;

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'ASK_BOX_AI_DRAFT_JIRA',
        title: 'Ask Box AI to draft a JIRA',
        contexts: ['selection'],
        // documentUrlPatterns: ['*://*.zendesk.com/*']
    });
});

/**
 * Helper function to display a banner in a specific tab.
 * @param {number} tabId - The ID of the tab where the banner should be displayed.
 * @param {string} message - The message to display in the banner.
 * @param {'success' | 'error' | 'info'} type - The type of banner.
 */
function showBannerInTab(tabId, message, type) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: displayBanner,
        args: [message, type]
    });
}

// Listener for messages from content scripts (like copyTextToClipboard)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "displayBanner" && sender.tab) {
    // If the message is to display a banner, execute the displayBanner function
    // in the tab where the message originated.
    showBannerInTab(sender.tab.id, request.message, request.bannerType);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== 'ASK_BOX_AI_DRAFT_JIRA' || !info.selectionText) return;
    const finalFileName = sanitizeFilename(`${tab.title}_${Date.now()}.md`);
    handleBoxAIDraftJira(finalFileName, info.selectionText, tab);
});

function sanitizeFilename(input) {
  // Remove invalid characters for filenames on most systems
  // These include: / \ ? % * : | " < > and control characters
  const sanitized = input
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')          // Remove control characters
    .replace(/[\/\\?%*:|"<>]/g, '')                // Remove reserved characters
    .replace(/\s+/g, '_')                          // Replace whitespace with underscore
    .replace(/\.+$/, '')                           // Remove trailing periods
    .substring(0, 255);                            // Limit length to 255 characters

  return sanitized || 'untitled'; // Fallback if filename is empty
}

async function askBoxAI(boxAccessToken, fileId, query, tab) {
  let attempt = 0;
  const maxAttempts = 5;
  while (attempt < maxAttempts) {
        try {
            showBannerInTab(tab.id, "Asking Box AI...", "info");
            const response = await fetch(`https://api.box.com/2.0/ai/ask`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${boxAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "mode": "single_item_qa",
                    "prompt": `${query}`,
                    "items": [
                        {
                            "type": "file",
                            "id": `${fileId}`
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`Box AI API request failed: ${response.statusText}`);
            }
            const jsonResponse = await response.json();
            return jsonResponse;
        } catch (error) {
            console.error('Error getting response from Box AI API:', error);
            showBannerInTab(tab.id, `Box AI request failed: ${error.message}`, "error");
        }
        attempt++;
    }
}

async function handleBoxAIDraftJira(fileName, text, tab) {
    showBannerInTab(tab.id, "Getting Box access token...", "info");
    const accessToken = await boxClient.getBoxAccessToken();
    if (!accessToken) {
        showBannerInTab(tab.id, "Box access token not found. Please login via Options.", "error");
        return console.error('Box access token not found. Please login via Options.');
    }

    showBannerInTab(tab.id, "Uploading file to Box...", "info");
    const { BOX__DESTINATION_FOLDER_ID: destinationFolder } = await chrome.storage.local.get('BOX__DESTINATION_FOLDER_ID');
    const fileId = await boxClient.uploadFile(
        fileName,
        new Blob([text], { type: 'text/markdown' }),
        destinationFolder.id || '0'
    );
    if (!fileId) {
        showBannerInTab(tab.id, "Failed to upload file to Box.", "error");
        return console.error('Failed to upload file to Box', uploadData);
    }
    console.log('Box upload complete, file ID:', fileId);
    showBannerInTab(tab.id, "File uploaded to Box, asking Box AI...", "info");
    const response = await askBoxAI(accessToken, fileId, aiQuery, tab);
    if (!response) {
        showBannerInTab(tab.id, "Failed to get response from Box AI.", "error");
        return console.error('Failed to get response from Box AI', response);
    }
    console.log('Box AI response:', response);
    chrome.scripting.executeScript({
        target: { tabId: tab.id }, // Target the current active tab
        function: copyTextToClipboard, // The function to inject and execute
        args: [response.answer || response.text || "No answer provided by Box AI."] // Pass the selected text as an argument to the function
    });
}

/**
 * This function is executed as a content script in the context of the webpage.
 * It takes the text to be copied and performs the clipboard operation.
 * It sends a message back to the background script to display the banner.
 * @param {string} textToCopy - The text string to be copied to the clipboard.
 */
function copyTextToClipboard(textToCopy) {
    // Create a temporary, invisible textarea element.
    const textarea = document.createElement('textarea');

    // Set the value of the textarea to the text we want to copy.
    textarea.value = textToCopy;

    // Make the textarea invisible and outside the viewport to avoid affecting layout.
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';

    // Append the textarea to the document body.
    document.body.appendChild(textarea);

    // Select the text within the textarea.
    textarea.select();

    let success = false;
    // Try to execute the copy command.
    try {
        success = document.execCommand('copy');
        if (success) {
            console.log('Text successfully copied by content script.');
            // Send message to background script for success banner
            chrome.runtime.sendMessage({ type: "displayBanner", message: "JIRA draft copied to clipboard!", bannerType: "success" });
        } else {
            console.error('Failed to execute copy command.');
            // Send message to background script for error banner
            chrome.runtime.sendMessage({ type: "displayBanner", message: "Failed to copy JIRA draft to clipboard!", bannerType: "error" });
        }
    } catch (err) {
        console.error('Error copying text:', err);
        // Send message to background script for error banner
        chrome.runtime.sendMessage({ type: "displayBanner", message: "Error copying JIRA draft to clipboard!", bannerType: "error" });
    } finally {
        // Always remove the temporary textarea from the DOM.
        document.body.removeChild(textarea);
    }
}

/**
 * Displays a temporary banner notification on the page.
 * This function is designed to be executed as a content script.
 * @param {string} message - The message to display in the banner.
 * @param {'success' | 'error' | 'info'} type - The type of banner ('success' for green, 'error' for red, 'info' for blue).
 */
function displayBanner(message, type) {
    // Remove any existing banners to prevent multiple banners from stacking.
    const existingBanner = document.getElementById('chrome-extension-copy-banner');
    if (existingBanner) {
        existingBanner.remove();
    }

    const banner = document.createElement('div');
    banner.id = 'chrome-extension-copy-banner';
    banner.textContent = message;

    // Basic styling for the banner
    banner.style.position = 'fixed';
    banner.style.top = '20px'; // Adjusted to 20px from the top
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)'; // Center horizontally
    banner.style.padding = '10px 20px';
    banner.style.borderRadius = '5px';
    banner.style.color = 'white';
    banner.style.fontWeight = 'bold';
    banner.style.fontSize = '1em';
    banner.style.zIndex = '99999'; // Ensure it's on top of most page content
    banner.style.textAlign = 'center';
    banner.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
    banner.style.opacity = '0'; // Start invisible for fade-in effect
    banner.style.transition = 'opacity 0.5s ease-in-out'; // Smooth fade transition
    banner.style.maxWidth = '80%'; // Prevent it from being too wide on large screens

    if (type === 'success') {
        banner.style.backgroundColor = '#4CAF50'; // Green
    } else if (type === 'error') {
        banner.style.backgroundColor = '#F44336'; // Red
    } else if (type === 'info') {
        banner.style.backgroundColor = '#2196F3'; // Blue
    }

    document.body.appendChild(banner);

    // Fade in the banner
    setTimeout(() => {
        banner.style.opacity = '1';
    }, 50); // Small delay to ensure transition applies

    // Remove the banner after a certain duration, shorter for info messages
    const duration = (type === 'info') ? 3000 : 7000; // 3 seconds for info, 7 seconds for others (slightly reduced)
    setTimeout(() => {
        banner.style.opacity = '0'; // Fade out
        setTimeout(() => {
            banner.remove(); // Remove from DOM after fade out
        }, 500); // Wait for fade-out transition
    }, duration);
}
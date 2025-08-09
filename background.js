import BOX from './utils/box.js';
import { defaultCustomInstructions } from './settings/config.js';
import { displayBanner } from './utils/banner.js';

const boxClient = new BOX();

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

// Listener for messages from content scripts or custom instruction prompts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in background script:', request);
    if (request.type === "displayBanner" && sender.tab) {
        showBannerInTab(sender.tab.id, request.message, request.bannerType);
    } else if (request.type === 'PROCESS_CUSTOM_INSTRUCTION' && sender.tab) {
        let finalInstruction = request.instruction;
        if (finalInstruction.includes('###SELECTED_TEXTS###')) {
            finalInstruction = finalInstruction.replace('###SELECTED_TEXTS###', request.selectionText);
        }
        if (finalInstruction.includes('###NAME_OF_UPLOADED_FILE###')) {
            finalInstruction = finalInstruction.replace('###NAME_OF_UPLOADED_FILE###', request.finalFileName);
        }
        // First, tell the content script to open chat and display the user's instruction
        chrome.tabs.sendMessage(sender.tab.id,{
            action: "open_chat_with_thinking_indicator",
            instruction: finalInstruction
        });
        // Then, process the custom instruction
        processInitialBoxAIQuery(
            request.finalFileName,
            request.selectionText,
            finalInstruction, // Pass the updated instruction
            request.modelConfig,
            sender.tab,
            request.targetItems
        );
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!info.menuItemId || !info.selectionText) return;
    const finalFileName = sanitizeFilename(`${tab.title}_${Date.now()}.md`);
    chrome.storage.local.get({ BOX__CUSTOM_INSTRUCTIONS: [] }, result => {
        const stored = result.BOX__CUSTOM_INSTRUCTIONS;
        const item =
            stored.find(i => i.id === info.menuItemId) ||
            defaultCustomInstructions.find(i => i.id === info.menuItemId);
        if (item) {
            if (!item.instruction) {
                // Case 1: Custom instruction - use prompt for instruction
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: promptForCustomInstructionAndSendMessage,
                    args: [info.selectionText, finalFileName, item.modelConfig, item.targetItems]
                });
            } else {
                let finalInstruction = item.instruction;
                if (finalInstruction.includes('###SELECTED_TEXTS###')) {
                    finalInstruction = finalInstruction.replace('###SELECTED_TEXTS###', info.selectionText);
                }
                if (finalInstruction.includes('###NAME_OF_UPLOADED_FILE###')) {
                    finalInstruction = finalInstruction.replace('###NAME_OF_UPLOADED_FILE###', finalFileName);
                }
                // Case 2: Pre-defined instruction - open chat and show thinking indicator
                chrome.tabs.sendMessage(tab.id, {
                    action: "open_chat_with_thinking_indicator",
                    instruction: finalInstruction
                });
                processInitialBoxAIQuery(
                    finalFileName,
                    info.selectionText,
                    finalInstruction,
                    item.modelConfig,
                    tab,
                    item.targetItems
                );
            }
        }
    });
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

/**
 * Ask Box AI with retry, showing banners, and optional model selection.
 * @param {string} fileId - The Box file ID to query.
 * @param {string} query - The prompt or instruction to send.
 * @param {string} [modelConfig] - Optional AI model ID to use.
 * @param {object} tab - The Chrome tab object for displaying banners.
 */
async function handleBoxAIQuery(query, targetItems, modelConfig, tab, conversationHistory = []) {
    let attempt = 0;
    const maxAttempts = 5;
    while (attempt < maxAttempts) {
        try {
            showBannerInTab(tab.id, "Asking Box AI...", "info");
            const response = await boxClient.askBoxAI(query, targetItems, modelConfig, conversationHistory);

            if (!response.ok) {
                throw new Error(`Box AI API request failed: ${response.statusText}`);
            }
            const jsonResponse = await response.json();
            showBannerInTab(tab.id, "Box AI response received", "success");
            return jsonResponse;
        } catch (error) {
            console.error('Error getting response from Box AI API:', error);
            showBannerInTab(tab.id, `Box AI request failed: ${error.message}`, "error");
        }
        attempt++;
    }
}

/**
 * Generic handler for Box AI requests with a custom instruction query.
 */
async function processInitialBoxAIQuery(fileName, text, instructionQuery, modelConfig, tab, targetItems = null) {
    const accessToken = await boxClient.getBoxAccessToken();
    if (!accessToken) {
        showBannerInTab(tab.id, "Box access token not found. Please login via Options.", "error");
        chrome.tabs.sendMessage(tab.id, { action: "receive_chat_message", message: "Box access token not found. Please login via Options." });
        return console.error('Box access token not found. Please login via Options.');
    }

    let fileId = null;
    let finalTargetItems = targetItems;

    // If targetItems is null or empty, initialize it with the placeholder for the uploaded file.
    if (!finalTargetItems || finalTargetItems.length === 0) {
        finalTargetItems = [
            {
                id: '###ID_OF_UPLOADED_FILE###',
                type: 'file',
            }
        ];
    }

    // Determine if a file upload is necessary based on targetItems:
    // 1. If any item in targetItems has the specific placeholder ID, an upload is needed.
    // 2. Otherwise (targetItems exists and no item contains the placeholder), no upload is needed.
    const needsUploadPlaceholder = (finalTargetItems && finalTargetItems.some(item => item.id === "###ID_OF_UPLOADED_FILE###"));
    const shouldUpload = needsUploadPlaceholder;

    if (shouldUpload) {
        showBannerInTab(tab.id, "Uploading file to Box...", "info");
        const { BOX__DESTINATION_FOLDER_ID: destinationFolder } = await chrome.storage.local.get('BOX__DESTINATION_FOLDER_ID');
        fileId = await boxClient.uploadFile(
            fileName,
            new Blob([text], { type: 'text/markdown' }),
            destinationFolder.id || '0'
        );
        if (!fileId) {
            showBannerInTab(tab.id, "Failed to upload file to Box.", "error");
            chrome.tabs.sendMessage(tab.id, { action: "receive_chat_message", message: "Failed to upload file to Box." });
            return console.error('Failed to upload file to Box');
        }

        uploadedFileId = fileId;

        if (!finalTargetItems || finalTargetItems.length === 0) {
            finalTargetItems = [{ type: 'file', id: fileId }];
        } else if (needsUploadPlaceholder) {
            // Replace the placeholder ID with the actual fileId
            finalTargetItems = finalTargetItems.map(item => {
                if (item.id === "###ID_OF_UPLOADED_FILE###") {
                    return { ...item, id: fileId };
                }
                return item;
            });
        }
    }

    currentModelConfig = modelConfig; // Store the modelConfig for subsequent chat messages
    currentTargetItems = finalTargetItems; // Store targetItems for subsequent chat messages
    showBannerInTab(tab.id, "Asking Box AI...", "info");
    const response = await handleBoxAIQuery(instructionQuery, finalTargetItems, modelConfig, tab, []);
    const aiReply = response.answer || "Failed to get response from Box AI.";

    conversationHistory = [
        {
            prompt: instructionQuery,
            answer: aiReply,
            created_at: response.created_at || new Date().toISOString()
        }
    ];

    chrome.tabs.sendMessage(tab.id, { 
        action: "receive_chat_message", 
        message: aiReply 
    });
}

/**
 * Initialize context menu items based on stored custom instructions.
 */
async function initializeContextMenus() {
    await chrome.contextMenus.removeAll();
    const { BOX__CUSTOM_INSTRUCTIONS: stored = [] } = await chrome.storage.local.get('BOX__CUSTOM_INSTRUCTIONS');
    const instructions = stored.length > 0 ? stored : defaultCustomInstructions;
    instructions
        .filter(item => item.enabled !== false) // Filter out disabled items
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .forEach(item => {
            chrome.contextMenus.create({
                id: item.id,
                title: item.title,
                contexts: ['selection'],
            });
        });
}

// Initialize on startup and when custom instructions change
initializeContextMenus();
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.BOX__CUSTOM_INSTRUCTIONS) {
        initializeContextMenus();
    }
});


function promptForCustomInstructionAndSendMessage(selectionText, finalFileName, modelConfig, targetItems) {
    const instruction = prompt('Enter your instruction for Box AI:');
    if (!instruction) {
        return;
    }
    chrome.runtime.sendMessage({
        type: 'PROCESS_CUSTOM_INSTRUCTION',
        instruction,
        selectionText,
        finalFileName,
        modelConfig,
        targetItems
    });
}

// When the user clicks on the extension action (toolbar icon).
chrome.action.onClicked.addListener((tab) => {
  // Send a message to the active tab to open the chat window.
  chrome.tabs.sendMessage(tab.id, { action: "open_chat" });
});

// --- Chat Functionality ---
let conversationHistory = [];
let currentTargetItems = null; // To keep track of targetItems if no file was uploaded
let currentModelConfig = null; // To keep track of the model config in conversation
let uploadedFileId = null; // To keep track of the uploaded file in conversation

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'send_chat_message') {
    handleChatMessage(request.message, sender.tab);
    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === 'chat_closed') {
    handleChatClosed(sender.tab);
    return true;
  }
});

async function handleChatMessage(message, tab) {
  if (!currentTargetItems) {
    showBannerInTab(tab.id, "Please start a new query from a selection first.", "info");
    return;
  }

  const userPrompt = message;

  try {
    // The history sent to the API should be all previous, complete exchanges.
    const historyToSend = [...conversationHistory];
    const response = await handleBoxAIQuery(userPrompt, currentTargetItems, currentModelConfig, tab, historyToSend);
    const aiReply = response.answer || 'Sorry, I couldn\'t get a response.';

    // Add the new, complete exchange to the history.
    conversationHistory.push({
        prompt: userPrompt,
        answer: aiReply,
        created_at: response.created_at || new Date().toISOString()
    });

    // Send the reply back to the content script
    chrome.tabs.sendMessage(tab.id, { 
      action: 'receive_chat_message', 
      message: aiReply 
    });

  } catch (error) {
    console.error('Error handling chat message:', error);
    chrome.tabs.sendMessage(tab.id, { 
      action: 'receive_chat_message', 
      message: `Error: ${error.message}` 
    });
  }
}

async function handleChatClosed(tab) {
  if (!currentTargetItems) return;

  const { BOX__DELETE_FILE_AFTER_COPY: deleteAfterCopy = false } =
    await chrome.storage.local.get({ BOX__DELETE_FILE_AFTER_COPY: false });

  if (deleteAfterCopy && uploadedFileId) {
    try {
      await boxClient.deleteFile(uploadedFileId);
      showBannerInTab(tab.id, "Uploaded file deleted from Box.", "info");
    } catch (err) {
      console.error("Error deleting file from Box:", err);
      showBannerInTab(tab.id, "Failed to delete file from Box.", "error");
    }
    // Reset for next time
    currentModelConfig = null;
    uploadedFileId = null;
  }
}

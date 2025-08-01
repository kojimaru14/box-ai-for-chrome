# Box AI for Chrome

Ask questions about selected text using the Box AI API directly from your Chrome browser.

## Features
- Upload selected text as a Markdown file to your Box account.
- Send custom AI instructions (e.g., draft JIRA tickets, summarize, translate) based on the uploaded file.
- Enter a custom AI instruction at runtime via the context menu.
- Copy AI-generated responses to the clipboard instantly with a notification banner.

## Installation

### Installing from Chrome Web Store

Install from [Chrome Web Store](https://chromewebstore.google.com/detail/box-ai-for-chrome/mimicfcbgocopnofklikpnmcckmiaadn) and skip to step 4. **Authorize and configure extension options** to start using it.

### Load as an Unpacked Extension
1. Download the ZIP from the releases page and unzip it, or clone this repository:
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select this repository's root folder.
5. Locate the extension's **ID** (e.g. `mimicfcbgocopnofklikpnmcckmiaadn`) and note it down; you'll need it in the Configuration step below.

#### Configuration
Before using the extension, you must set up your Box API credentials and authorize the extension:
  
1. **Create a Box Developer Application**
   - Go to the [Box Developer Console](https://app.box.com/developers/console).
   - Click **Create New App** and choose **Custom App** → **OAuth 2.0 (User Authentication)**.
   - Name your app and click **Create App**, then go to **Configuration** tab and note down the **Client ID** and **Client Secret**; you'll need it in the step for "Configure local credentials" below.

   > References: 
   > https://developer.box.com/guides/authentication/oauth2/oauth2-setup/#app-creation-steps

2. **Configure your Box app**
   - On **Configuration** tab, enable the following checkboxes:
      - **Write all files and folders stored in Box**
      - **Manage AI**
   - Register the following settings using the extension ID noted above:

      - **OAuth2 Redirect URI**:
      ```
      https://<YOUR_EXTENSION_ID>.chromiumapp.org/
      ```

      - **CORS Domains**:
      ```
      chrome-extension://<YOUR_EXTENSION_ID>
      ```

3. **Configure local credentials**  
   - Rename `settings/config.js.example` to `settings/config.js`
      ```bash
      mv settings/config.js.example settings/config.js
      ```  
   - Open `settings/config.js` and replace `BOX__CLIENT_ID` and `BOX__CLIENT_SECRET` with the values from your Box app (which you obtained in the step for "Create a Box Developer Application" above)

4. **Authorize and configure extension options**
   - Click the extension icon in the toolbar and select **Options**.
   - On the Options page, click **Login to Box** and follow the OAuth prompts.
   - Choose a destination folder in your Box account for uploads.
   - (Optional) Edit, add, or remove custom AI instructions for the context menu commands, select a preferred AI model (LLM) for each instruction, and click **Save Instructions**.

## Usage
1. Navigate to any web page and select the text you want to analyze.
2. Right-click and choose one of the Box AI actions (e.g., *Send a custom instruction*, *Draft a JIRA*, *Summarize the texts*).
3. The extension uploads the selected text to Box, sends it to Box AI with your chosen instruction,
   and copies the AI response to your clipboard.
4. A notification banner confirms that the AI response has been copied to your clipboard.

## Development
- Built with [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/) and plain JavaScript.
- Key components:
  - `manifest.json`: Extension metadata and permissions.
  - `background.js`: Service worker handling context menus, Box API calls, and messaging.
  - `content.js`: Content script for banners and clipboard operations.
  - `popup/`: Popup UI for opening Options.
  - `settings/`: Options page UI and default configuration.
  - `utils/`: Shared utility scripts, including the Box API wrapper (`box.js`) and banner notifications (`banner.js`).
  - `vendor/`: Third-party libraries like Bootstrap and Box UI Elements.
  - `zip-extension.sh`: Script for creating a ZIP package (for Chrome Web Store upload). Usage: run this at the root of the repository
      ```bash
      ./zip-extension.sh [output-name.zip]
      ```

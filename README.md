# Box AI for Chrome

Ask questions about selected text using the Box AI API directly from your Chrome browser.

## Features
- Upload selected text as a Markdown file to your Box account.
- Send custom AI instructions (e.g., draft JIRA tickets, summarize, translate) based on the uploaded file.
- Copy AI-generated responses to the clipboard instantly with a notification banner.

## Installation
### Load as an Unpacked Extension
1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select this repository's root folder.

### Packaging for Distribution
Use the provided script to create a ZIP package (suitable for Chrome Web Store upload):
```bash
./zip-extension.sh [output-name.zip]
```

## Configuration
Before using the extension, you need to authorize it with your Box account and configure options:

1. Click the extension icon in the toolbar and select **Options**.
2. On the Options page:
   - Click **Login to Box** and follow the OAuth flow to grant access.
   - Choose a destination folder in your Box account where files will be uploaded.
   - (Optional) Edit or add custom AI instructions for the context menu commands.
   - Click **Save Instructions**.

_Note:_ Default client credentials are defined in `settings/config.js`. To use your own Box API credentials,
update the values of `BOX__CLIENT_ID` and `BOX__CLIENT_SECRET` in that file.

## Usage
1. Navigate to any web page and select the text you want to analyze.
2. Right-click and choose one of the Box AI actions (e.g., *Draft a JIRA*, *Summarize the texts*).
3. The extension uploads the selected text to Box, sends it to Box AI with your chosen instruction,
   and copies the AI response to your clipboard.
4. A banner notification appears confirming the upload and clipboard copy.

## Development
- Built with [Manifest V3](https://developer.chrome.com/docs/extensions/mv3/) and plain JavaScript.
- Key components:
  - `manifest.json`: Extension metadata and permissions.
  - `background.js`: Service worker handling context menus, Box API calls, and messaging.
  - `content.js`: Content script for banners and clipboard operations.
  - `box.js`: Wrapper for Box OAuth, file uploads, and AI queries.
  - `popup/`: Popup UI for opening Options.
  - `settings/`: Options page UI and default configuration.

## License
This project is provided under the [MIT License](LICENSE) (if applicable).

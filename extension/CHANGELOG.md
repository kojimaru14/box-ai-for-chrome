# Changelog

All notable changes to Box AI for Chrome are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.10] - 2026-08-25

### Added

- Changelog, viewable from the Options page.

### Changed

- Extension files live in `extension/`. Load that folder as an unpacked extension.

## [1.1.9] - 2026-08-25

### Added

- Development vs Chrome Web Store build indicators: a **DEV** badge on the toolbar icon, a banner on the Options page, build info in the popup, a page overlay, and a compact **DEV** badge on the chat header.
- Version (`v…`) shown in the popup, Options page, and toolbar tooltip on all builds.

### Fixed

- Content scripts run as classic scripts again so the extension works on Gmail.
- Chat header stays on one line when the DEV badge is shown.
- Dev banner on the Options page stays pinned to the top while scrolling.

## [1.1.6] - 2025-08-09

### Added

- Multi-document Q&A: override **Target Contents** for a custom instruction (files or hubs).
- Internal-only default instructions, shown only to users on allowed domains.
- GPT-5 added to the available models list.
- **Clear Cache** button in the popup.
- Privacy Policy.

### Changed

- Chat state is stored per tab in `chrome.storage.local` so it survives service-worker restarts.
- Uploaded files are deleted from Box when the chat window is closed (if cleanup is enabled), instead of immediately after the AI response.
- Closing a tab or Chrome window clears that tab's chat state and, when cleanup is enabled, deletes the uploaded file.
- Sort order for new instructions starts at 1 and is prefilled with the next available number.

### Fixed

- Custom instruction prompt at runtime failed with an unserializable `executeScript` argument.
- Instruction table did not refresh after login.

## [1.1.5] - 2025-08-07

### Added

- Minimize, dock, and restore controls on the chat window, including a Box AI icon while minimized.

### Fixed

- Login to Box error handling on the Options page.
- Chat window could not be reopened from the minimized state.
- Minimized chat icon appeared in the wrong place after dragging the window.

## [1.1.4] - 2025-08-06

### Added

- In-page chat window for Box AI conversations, opened from the context menu.
- Copy-to-clipboard on chat responses.
- Conversation history for pre-configured custom instructions.

## [1.1.3] - 2025-08-05

### Added

- Custom instruction entered at runtime from the context menu.
- Preferred LLM (model) per custom instruction.
- Language (English or Japanese) per custom instruction.
- Agent config (advanced) per custom instruction.
- Show/hide each instruction in the context menu.
- Bootstrap-based Options page UI.

### Changed

- Access tokens are encrypted before they are stored locally.
- Saving an instruction in the edit modal writes it immediately (no separate Save Instructions button).

### Fixed

- 401 error on the first Box login from the Options page.

## [1.0.0] - 2025-07-29

### Added

- Upload selected page text to Box as Markdown and ask Box AI about it.
- Options page: Box login, destination folder picker, and custom instructions.
- Option to delete the uploaded file from Box after use.
- Context-menu actions for configured instructions.

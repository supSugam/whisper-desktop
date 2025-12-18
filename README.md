# Whisper+

![License](https://img.shields.io/badge/License-MIT-blue.svg) ![Tauri](https://img.shields.io/badge/Tauri-2.0-orange) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6) ![Rust](https://img.shields.io/badge/Rust-1.70+-000000)

A lightweight & cross-platform desktop app that brings ChatGPT's voice-to-text feature to your desktop using your own ChatGPT session key.

## Features

-   **Global Shortcut**: Toggle recording from any application using `Ctrl+Alt+Space`.
-   **Auto-Paste**: Automatically types the transcribed text into the active window.
-   **Auto-Copy**: Copies the transcription to the system clipboard.
-   **System Tray**: Runs silently in the background.
-   **History**: Maintains a local log of previous transcriptions.

## Installation

### Quick Install (Linux & macOS)

Run the following command in your terminal to automatically detect and install the correct version for your system:

```bash
curl -fsSL https://raw.githubusercontent.com/supSugam/whisper-desktop/main/install.sh | bash
```

### Manual Installation

Download the latest installer or executable for your platform from the [Releases page](https://github.com/supSugam/whisper-plus/releases).

-   **Windows**: `.exe` installer.
-   **Linux**: `.AppImage`, `.deb`, or `.rpm`.
-   **macOS**: `.dmg`.

## Configuration

Whisper+ requires a valid ChatGPT session token to communicate with the OpenAI API. The application stores this token locally and communicates directly with `chatgpt.com`.

> [!IMPORTANT]
> **Security Warning**: Your session token gives valid access to your ChatGPT account. **Never share this token with anyone.** This application stores it locally on your machine and only uses it to communicate directly with OpenAI servers.

### Retrieving the Session Token

#### Method 1: Developer Tools (Recommended)
1.  Log in to [chatgpt.com](https://chatgpt.com).
2.  Open Developer Tools (`F12`).
3.  Navigate to the **Application** tab and select **Cookies** > `https://chatgpt.com`.
4.  Locate the cookie named `__Secure-next-auth.session-token`.
5.  Copy the value and paste it into the Whisper+ settings.

#### Method 2: Browser Extension
1.  Install a cookie editor extension such as [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc).
2.  While on `chatgpt.com`, open the extension.
3.  Search/Find `__Secure-next-auth.session-token`.
4.  Copy the value and paste it into the Whisper+ settings.

**Note**: If you experience connection issues, you may also need to copy your browser's "User Agent" string into the application settings to match your session.

## Development

To build the application from source:

### Prerequisites

-   [Node.js](https://nodejs.org/)
-   [Rust](https://www.rust-lang.org/tools/install)
-   **Linux Dependencies**:
    ```bash
    sudo apt-get install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
    ```

### Build Instructions

1.  Clone the repository:
    ```bash
    git clone https://github.com/supSugam/whisper-plus.git
    cd whisper-plus
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run in development mode:
    ```bash
    npm run tauri dev
    ```
4.  Build for production:
    ```bash
    npm run tauri build
    ```

## Contributing

Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
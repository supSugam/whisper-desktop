# Whisper+

![License](https://img.shields.io/badge/License-MIT-blue.svg) ![Tauri](https://img.shields.io/badge/Tauri-2.0-orange) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6) ![Rust](https://img.shields.io/badge/Rust-1.70+-000000)

Bring ChatGPT's powerful speech-to-text capabilities directly to your desktop. **Whisper+** is a lightweight, cross-platform utility that records your voice and transcribes it using OpenAI's Whisper model (via ChatGPT session), instantly copying the text to your clipboard or pasting it into your active application.

## Table of Contents
- [Features](#features)
- [How it Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Session Token Guide](#session-token-guide)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Global Shortcuts**: Toggle recording from anywhere (`F2` by default).
- **Auto-Paste**: Automatically types transcription into your active window.
- **Auto-Copy**: Copies transcription to clipboard immediately.
- **System Tray**: Runs silently in the background; close window to minimize.
- **Sound Effects**: Audio feedback for start/stop recording.
- **History**: Searchable local history of all your transcriptions.
- **Modern UI**: Clean, dark-themed interface built with Tauri v2.

## How it Works

1.  **Record**: Press the global shortcut or click the mic button.
2.  **Transcribe**: The app securely sends the audio to ChatGPT's API using your session token.
3.  **Action**: The text is returned and automatically handled based on your settings (pasted/copied).

## Prerequisites

- **ChatGPT Account**: You need an active account at [chatgpt.com](https://chatgpt.com).
- **Session Token**: The app uses your browser's session token to authenticate requests.

## Installation

Download the latest release for your platform from the [Releases](https://github.com/supSugam/whisper-plus/releases) page.

### Linux
- **AppImage**: Download `Whisper+_x.x.x_amd64.AppImage`, make it executable (`chmod +x`), and run.
- **DEB**: Download `Whisper+_x.x.x_amd64.deb` and install (`sudo dpkg -i ...`).
- **RPM**: Download `Whisper+-x.x.x.rpm` and install.

## Configuration

To use Whisper+, you must configure your ChatGPT Session Token.

> [!IMPORTANT]
> **Security Warning**: Your session token gives full access to your ChatGPT account. **Never share this token with anyone.** This app stores it locally on your machine and only uses it to communicate directly with OpenAI servers.

### Session Token Guide

#### Method 1: Developer Tools (Recommended)
1.  Go to [chatgpt.com](https://chatgpt.com) and log in.
2.  Press `F12` to open Developer Tools.
3.  Navigate to the **Application** tab (you may need to click `>>` to see it).
4.  In the sidebar, expand **Cookies** and select `https://chatgpt.com`.
5.  Find the cookie named `__Secure-next-auth.session-token`.
6.  Copy its **Value**.
7.  Paste it into the **Session Token** field in Whisper+ Settings.

#### Method 2: Browser Extension
1.  Install a cookie editor extension usage as [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc).
2.  While on `chatgpt.com`, open the extension.
3.  Search/Find `__Secure-next-auth.session-token`.
4.  Copy the value and paste it into Whisper+ Settings.

## Development

If you want to build from source or contribute:

### Prerequisites
- [Node.js](https://nodejs.org/) & npm
- [Rust](https://www.rust-lang.org/tools/install)
- System dependencies (Linux):
  ```bash
  sudo apt-get install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  # To avoid runtime GStreamer warnings:
  sudo apt-get install gstreamer1.0-plugins-bad gstreamer1.0-plugins-base gstreamer1.0-plugins-good
  ```

### Setup
1.  Clone the repository:
    ```bash
    git clone https://github.com/supSugam/whisper-plus.git
    cd whisper-plus
    ```
2.  Install frontend dependencies:
    ```bash
    npm install
    ```
3.  Run in development mode:
    ```bash
    npm run tauri dev
    ```

### Build for Release
To build the application for your OS:
```bash
npm run tauri build
```
Artifacts will be in `src-tauri/target/release/bundle/`.

## Contributing

Contributions are welcome!

1.  **Fork** the repository.
2.  Create a **Feature Branch** (`git checkout -b feature/AmazingFeature`).
3.  **Commit** your changes (`git commit -m 'Add some AmazingFeature'`).
4.  **Push** to the branch (`git push origin feature/AmazingFeature`).
5.  Open a **Pull Request**.

Please ensure your code follows the existing style and all lint checks pass.

## License

Distributed under the MIT License. See `LICENSE` for more information.

# Yappie

![License](https://img.shields.io/badge/License-MIT-blue.svg) ![Tauri](https://img.shields.io/badge/Tauri-2.0-orange) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6) ![Rust](https://img.shields.io/badge/Rust-1.70+-000000)

A lightweight cross-platform application that brings OpenAI Whisper's voice-to-text capabilities to your desktop.

![alt text](screenshots/whisper-plus.png)

## Table of Contents

- [Features](#features)
- [Transcription Engine](#transcription-engine)
- [Installation](#installation)
- [Configuration](#configuration)
    - [Custom Shortcuts](#custom-shortcuts)
    - [Wayland Users (Linux)](#wayland-users-linux)
- [Development](#development)

---

## Features

-   **Privacy & Offline**: Your audio never leaves your computer. Transcription runs entirely on your device.
-   **GPU Acceleration**: Native support for **NVIDIA (CUDA)** and **AMD/Cross-platform (Vulkan)** for blazing fast local inference.
-   **Smart Hardware Detection**: Automatically detects your CPU/GPU capabilities and RAM to suggest optimal settings.
-   **Global Shortcuts**: Toggle recording from anywhere. Fully customizable on X11/Windows/macOS.
-   **Auto-Paste & Copy**: Automatically types text into your active window or copies to clipboard.
-   **History with Stats**: View past recordings with detailed metadata (Backend used, processing time).
-   **Multilingual Translation**: Seamlessly translate foreign speech into English text using the "Translate to English" toggle.
-   **System Tray**: Runs silently in the background.

---

## Transcription Engine

Yappie runs the AI model **entirely on your device**.

-   **Privacy**: Your audio never leaves your computer.
-   **Offline**: Works without an internet connection.
-   **Fast**: Fast on GPUs (often near real-time).
-   **Cost**: Free.

**Requirements:**
-   **No Python/PyTorch needed**: The engine is self-contained.
-   **Linux**: Requires `libasound2` (installed by default on most distros). Specialized GPU drivers (Nvidia/AMDGPU) are needed only if you want GPU acceleration.
-   **macOS**: No special requirements.
-   **Windows**: No special requirements.

**How it works:**
The app handles everything for you. It downloads the optimized Whisper models files (GGUF format) and runs them using `whisper.cpp` bindings.

**Translation Mode:**
When using Local Whisper, you can enable **"Translate to English"** in settings. This allows you to speak in any supported language (Japanese, French, Spanish, etc.) and receive perfectly translated English text instantly. We've implemented custom filtering to eliminate common "ghost" translations like *(Speaking in foreign language)*.

**Performance & Hardware:**
-   **GPU Users**: The app automatically detects NVIDIA or AMD GPUs and enables acceleration.
-   **CPU Users**: Works fine on modern CPUs! Just stick to "Tiny" or "Base" models for speed.
-   **Model Selection**:
    -   `Tiny` (~75MB): Fastest, good for simple commands.
    -   `Base` (~142MB): Balanced.
    -   `Medium` (~1.5GB): High accuracy. **Recommended max** unless you have 16GB+ RAM.
    -   `Large` (~3GB): Best accuracy, but slow on CPU.

> [!TIP]
> **Privacy Note**: This is the most secure method. It is completely offline, everything happens locally on your device.

---

## Installation

### Quick Install (Linux & macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/supSugam/whisper-desktop/main/install.sh | bash
```

### Manual Installation
Download the latest installer from [Releases](https://github.com/supSugam/whisper-desktop/releases):
-   **Windows**: `.exe`
-   **Linux**: `.deb`, `.rpm`
-   **macOS**: `.dmg`

---

## Configuration

### Custom Shortcuts
-   **Windows/macOS/X11**: Go to Settings > Shortcut. Click the **Record** button and press your desired combination (e.g., `Ctrl+Shift+L`).
-   **Wayland**: See below.

### Wayland Users (Linux)
Global shortcuts on Wayland are restricted by security protocols.
1.  Go to **System Settings > Keyboard > Shortcuts**.
2.  Create a **Custom Shortcut**.
3.  **Command**: `yappie --toggle`
4.  **Shortcut**: Set your desired keys.

> [!NOTE]
> Auto-paste on Wayland only works with "some" XWayland apps (e.g. VSCode, Discord). Native Wayland apps may not receive the text automatically.

---

## Development

To build the application from source:

### Prerequisites

-   **Node.js**: [Download](https://nodejs.org/) (v16+)
-   **Rust**: [Install](https://www.rust-lang.org/tools/install)
-   **Linux Dependencies** (Ubuntu/Debian):
    ```bash
    # Core Libraries (GUI, System Tray)
    sudo apt-get install libwebkit2gtk-4.1-dev \
        build-essential \
        curl \
        wget \
        file \
        libssl-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev

    # Audio Dependencies (Required for recording)
    sudo apt-get install libasound2-dev

    # GPU Dependencies (Vulkan - Recommended for AMD/Intel/Nvidia)
    sudo apt-get install libvulkan1 mesa-vulkan-drivers vulkan-tools libvulkan-dev
    
    # Optional: CUDA (NVIDIA only)
    # sudo apt-get install nvidia-cuda-toolkit
    ```

### Build Instructions

1.  Clone & Install:
    ```bash
    git clone https://github.com/supSugam/whisper-desktop.git
    cd whisper-desktop
    npm install
    ```

2.  **Dev Mode (Default with Vulkan)**:
    ```bash
    npm run tauri dev
    ```
    *Note: Vulkan support is enabled by default for broad GPU compatibility.*

3.  **Specific Backends**:
    If you want to force specific backends, use feature flags:
    ```bash
    # NVIDIA (CUDA) - Requires CUDA Toolkit installed
    npm run tauri dev -- --features cuda

    # AMD (ROCm) - Requires ROCm installed
    npm run tauri dev -- --features rocm
    ```

4.  **Build Release**:
    ```bash
    npm run tauri build
    ```

## License
MIT License.
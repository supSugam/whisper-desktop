#!/bin/bash

# Configuration
VERSION="1.0.4"
TAG="v1.0.4"
BASE_URL="https://github.com/supSugam/whisper-desktop/releases/download/$TAG"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Yappie Installer ($TAG)${NC}"

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detected OS: $OS"
echo "Detected Arch: $ARCH"

function show_local_model_info() {
    echo -e "\n${BLUE}--- Local Model Optimization ---${NC}"
    if [ "$1" = "Linux" ]; then
        echo -e "To use the ${GREEN}Local Whisper${NC} engine efficiently:"
        echo -e "1. Ensure ${YELLOW}libasound2${NC} is installed (usually default)."
        echo -e "2. For GPU acceleration (highly recommended):"
        echo -e "   - ${YELLOW}NVIDIA${NC}: Install NVIDIA drivers and CUDA toolkit."
        echo -e "   - ${YELLOW}AMD/Intel${NC}: Install ${YELLOW}libvulkan1${NC} and Vulkan drivers."
        echo -e "     (e.g., sudo apt install libvulkan1 mesa-vulkan-drivers)"
    elif [ "$1" = "Darwin" ]; then
        echo -e "Local Whisper works out of the box on macOS!"
        echo -e "Apple Silicon (M1/M2/M3) is fully optimized."
    fi
    echo -e "----------------------------------\n"
}

if [ "$OS" = "Linux" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        if command -v dpkg >/dev/null && command -v apt-get >/dev/null; then
            # Debian/Ubuntu
            FILE="yappie_${VERSION}_amd64.deb"
            URL="$BASE_URL/$FILE"
            DEST="/tmp/$FILE"
            
            echo "Detected Debian/Ubuntu system."
            echo -e "Downloading ${GREEN}$FILE${NC}..."
            if curl -L -o "$DEST" "$URL"; then
                echo "Installing..."
                sudo dpkg -i "$DEST"
                sudo apt-get install -f -y
                rm "$DEST"
                show_local_model_info "Linux"
                echo -e "${GREEN}Installation complete! Run 'yappie' to start.${NC}"
            else
                echo -e "${RED}Download failed.${NC}"
                exit 1
            fi
            
        elif command -v rpm >/dev/null; then
            # RHEL/Fedora
            FILE="yappie-${VERSION}-1.x86_64.rpm"
            URL="$BASE_URL/$FILE"
            DEST="/tmp/$FILE"
            
            echo "Detected RHEL/Fedora system."
            echo -e "Downloading ${GREEN}$FILE${NC}..."
            if curl -L -o "$DEST" "$URL"; then
                echo "Installing..."
                sudo rpm -i "$DEST"
                rm "$DEST"
                show_local_model_info "Linux"
                echo -e "${GREEN}Installation complete! Run 'yappie' to start.${NC}"
            else
                echo -e "${RED}Download failed.${NC}"
                exit 1
            fi
            
        else
            echo -e "${RED}No supported package manager (dpkg/rpm) found for Linux.${NC}"
            echo -e "Please compile from source or check the GitHub releases."
            exit 1
        fi
    else
        echo -e "${RED}Unsupported Linux architecture: $ARCH${NC}"
        exit 1
    fi

elif [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        FILE="yappie_${VERSION}_aarch64.dmg"
        URL="$BASE_URL/$FILE"
        DEST="/tmp/$FILE"
        
        echo "Detected macOS (Apple Silicon)."
        echo -e "Downloading ${GREEN}$FILE${NC}..."
        if curl -L -o "$DEST" "$URL"; then
            echo "Mounting DMG..."
            hdiutil attach "$DEST"
            show_local_model_info "Darwin"
            echo -e "${GREEN}Please drag Yappie to your Applications folder in the window that opens.${NC}"
        else
            echo -e "${RED}Download failed.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Unsupported macOS architecture: $ARCH (Only Apple Silicon supported)${NC}"
        exit 1
    fi

else
    echo -e "${RED}Unsupported OS: $OS${NC}"
    exit 1
fi

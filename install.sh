#!/bin/bash

# Configuration
VERSION="1.0.2"
TAG="v1.0.2"
BASE_URL="https://github.com/supSugam/whisper-desktop/releases/download/$TAG"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Whisper+ Installer ($TAG)${NC}"

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "Detected OS: $OS"
echo "Detected Arch: $ARCH"

if [ "$OS" = "Linux" ]; then
    if [ "$ARCH" = "x86_64" ]; then
        if command -v dpkg >/dev/null && command -v apt-get >/dev/null; then
            # Debian/Ubuntu
            FILE="whisper-plus_${VERSION}_amd64.deb"
            URL="$BASE_URL/$FILE"
            DEST="/tmp/$FILE"
            
            echo "Detected Debian/Ubuntu system."
            echo -e "Downloading ${GREEN}$FILE${NC}..."
            if curl -L -o "$DEST" "$URL"; then
                echo "Installing..."
                sudo dpkg -i "$DEST"
                sudo apt-get install -f -y
                rm "$DEST"
                echo -e "${GREEN}Installation complete! Run 'whisper-plus' to start.${NC}"
            else
                echo -e "${RED}Download failed.${NC}"
                exit 1
            fi
            
        elif command -v rpm >/dev/null; then
            # RHEL/Fedora
            FILE="whisper-plus-${VERSION}-1.x86_64.rpm"
            URL="$BASE_URL/$FILE"
            DEST="/tmp/$FILE"
            
            echo "Detected RHEL/Fedora system."
            echo -e "Downloading ${GREEN}$FILE${NC}..."
            if curl -L -o "$DEST" "$URL"; then
                echo "Installing..."
                sudo rpm -i "$DEST"
                rm "$DEST"
                echo -e "${GREEN}Installation complete! Run 'whisper-plus' to start.${NC}"
            else
                echo -e "${RED}Download failed.${NC}"
                exit 1
            fi
            
        else
            # Fallback to AppImage
            FILE="whisper-plus_${VERSION}_amd64.AppImage"
            URL="$BASE_URL/$FILE"
            DEST="./whisper-plus.AppImage"
            
            echo "No supported package manager found. Falling back to AppImage."
            echo -e "Downloading ${GREEN}$FILE${NC}..."
            if curl -L -o "$DEST" "$URL"; then
                chmod +x "$DEST"
                echo -e "${GREEN}Download complete! Run with ./whisper-plus.AppImage${NC}"
            else
                echo -e "${RED}Download failed.${NC}"
                exit 1
            fi
        fi
    else
        echo -e "${RED}Unsupported Linux architecture: $ARCH${NC}"
        exit 1
    fi

elif [ "$OS" = "Darwin" ]; then
    if [ "$ARCH" = "arm64" ]; then
        FILE="whisper-plus_${VERSION}_aarch64.dmg"
        URL="$BASE_URL/$FILE"
        DEST="/tmp/$FILE"
        
        echo "Detected macOS (Apple Silicon)."
        echo -e "Downloading ${GREEN}$FILE${NC}..."
        if curl -L -o "$DEST" "$URL"; then
            echo "Mounting DMG..."
            hdiutil attach "$DEST"
            echo -e "${GREEN}Please drag Whisper+ to your Applications folder in the window that opens.${NC}"
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

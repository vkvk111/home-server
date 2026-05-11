#!/usr/bin/env bash
# 02-node.sh — Install Node.js LTS on Raspberry Pi.
#
# NodeSource does not support armv6l (Pi Zero / Pi 1).
# For armv6l we pull the unofficial armv6l build from nodejs.org.
# For arm64/amd64 we use NodeSource as normal.

set -euo pipefail

PROJECT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

log() { echo -e "\033[1;34m[02-node]\033[0m $*"; }

SUDO="${SUDO:-$([ $EUID -eq 0 ] && echo '' || echo 'sudo')}"
NODE_MAJOR=20     # LTS codename: Iron
ARCH="$(uname -m)"  # armv6l | armv7l | aarch64 | x86_64

if command -v node &>/dev/null; then
  log "Node.js already installed: $(node --version) — skipping."
else
  if [[ "$ARCH" == "armv6l" ]]; then
    # ── Unofficial armv6l build ───────────────────────────────────────────────
    log "Detected armv6l — using unofficial Node.js armv6l build…"

    # Extract the first "vMAJOR.minor.patch" string from the JSON index
    NODE_VERSION=$(curl -fsSL \
      "https://unofficial-builds.nodejs.org/download/release/index.json" \
      | grep -o "\"v${NODE_MAJOR}\.[0-9]*\.[0-9]*\"" \
      | head -1 \
      | tr -d '"')

    if [[ -z "$NODE_VERSION" ]]; then
      NODE_VERSION="v20.19.2"
      log "Version lookup failed — falling back to $NODE_VERSION"
    fi

    log "Target version: $NODE_VERSION"
    TARBALL="node-${NODE_VERSION}-linux-armv6l.tar.xz"
    URL="https://unofficial-builds.nodejs.org/download/release/${NODE_VERSION}/${TARBALL}"

    log "Downloading $URL …"
    curl -fsSL "$URL" -o "/tmp/${TARBALL}"

    log "Extracting to /usr/local …"
    $SUDO tar -xJf "/tmp/${TARBALL}" -C /usr/local --strip-components=1
    rm -f "/tmp/${TARBALL}"

  else
    # ── NodeSource (arm64 / amd64) ────────────────────────────────────────────
    log "Installing Node.js $NODE_MAJOR LTS via NodeSource…"
    if [[ -z "$SUDO" ]]; then
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    else
      curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | $SUDO -E bash -
    fi
    $SUDO apt-get install -y nodejs
  fi

  log "Node.js $(node --version) installed."
fi

log "Installing npm dependencies in $PROJECT_DIR…"
cd "$PROJECT_DIR"
npm install --omit=dev

log "Node setup complete."

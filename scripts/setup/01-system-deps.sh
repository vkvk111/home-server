#!/usr/bin/env bash
# 01-system-deps.sh — Install system-level packages on DietPi (apt).
# DietPi is a minimal Debian-based image; many packages are absent by default.

set -euo pipefail

log() { echo -e "\033[1;34m[01-system-deps]\033[0m $*"; }

# Inherit SUDO from setup.sh; fall back gracefully when run standalone.
SUDO="${SUDO:-$([ $EUID -eq 0 ] && echo '' || echo 'sudo')}"

log "Updating package lists…"
$SUDO apt-get update -qq

PACKAGES=(
  git
  curl
  ca-certificates        # often missing on fresh DietPi images
  gnupg                  # needed by NodeSource setup script
  python3
  python3-pip
  python3-venv
  build-essential
  raspi-gpio             # userspace GPIO tool (DietPi-compatible)
)

log "Installing: ${PACKAGES[*]}"
$SUDO apt-get install -y --no-install-recommends "${PACKAGES[@]}"

# ── GPIO group ────────────────────────────────────────────────────────────────
# On DietPi the gpio group may not exist; create it and add the current user.
if ! getent group gpio &>/dev/null; then
  log "Creating gpio group…"
  $SUDO groupadd --system gpio
fi

CURRENT_USER="${SUDO_USER:-$(whoami)}"
if [[ "$CURRENT_USER" != "root" ]]; then
  log "Adding $CURRENT_USER to gpio group (re-login required to take effect)…"
  $SUDO usermod -aG gpio "$CURRENT_USER"
fi

# Allow the gpio group to access /dev/gpiomem without root
if [ -e /dev/gpiomem ]; then
  $SUDO chown root:gpio /dev/gpiomem
  $SUDO chmod g+rw /dev/gpiomem
fi

log "System dependencies installed."

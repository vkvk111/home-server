#!/usr/bin/env bash
# 03-python-deps.sh — Set up a Python venv and install GPIO requirements.

set -euo pipefail

PROJECT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
VENV_DIR="$PROJECT_DIR/.venv"
REQUIREMENTS="$PROJECT_DIR/scripts/gpio/requirements.txt"

log() { echo -e "\033[1;34m[03-python-deps]\033[0m $*"; }

log "Creating Python venv at $VENV_DIR…"
python3 -m venv "$VENV_DIR"

log "Installing Python packages from $REQUIREMENTS…"
"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install -r "$REQUIREMENTS"

# Write the venv python path to .env so Node picks it up
ENV_FILE="$PROJECT_DIR/.env"
PYTHON_LINE="PYTHON_BIN=$VENV_DIR/bin/python3"

if [ -f "$ENV_FILE" ] && grep -q "^PYTHON_BIN=" "$ENV_FILE"; then
  sed -i "s|^PYTHON_BIN=.*|$PYTHON_LINE|" "$ENV_FILE"
else
  echo "$PYTHON_LINE" >> "$ENV_FILE"
fi

log "Python deps installed. PYTHON_BIN written to .env."

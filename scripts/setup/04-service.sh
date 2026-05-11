#!/usr/bin/env bash
# 04-service.sh — Install home-server systemd services on DietPi.
#
# Installs two units:
#   home-server-init.service  — boot sequence (WiFi check → git pull → AP mode)
#   home-server.service       — Node.js server (starts after init completes)
#
# Usage: bash scripts/setup/04-service.sh

set -euo pipefail

PROJECT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

log()  { echo -e "\033[1;34m[04-service]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ ok ]\033[0m $*"; }

SUDO="${SUDO:-$([ $EUID -eq 0 ] && echo '' || echo 'sudo')}"

# Resolve the node binary
NODE_BIN="$(command -v node)"
INIT_SERVICE="home-server-init"
NODE_SERVICE="home-server"
INIT_FILE="/etc/systemd/system/${INIT_SERVICE}.service"
NODE_FILE="/etc/systemd/system/${NODE_SERVICE}.service"

# On DietPi running as root the working user is root.
# If a non-root SUDO_USER exists, run the service as that user.
RUN_USER="${SUDO_USER:-root}"
RUN_GROUP="${RUN_USER}"

log "Installing systemd units…"
log "  Project dir : $PROJECT_DIR"
log "  Node binary : $NODE_BIN"
log "  Run as user : $RUN_USER"

# ── home-server-init.service ──────────────────────────────────────────────────
# Type=oneshot so systemd waits for the startup sequence to finish before
# starting home-server.service.
log "Writing $INIT_SERVICE.service…"
$SUDO tee "$INIT_FILE" > /dev/null <<EOF
[Unit]
Description=Home Server — Boot Sequence (WiFi check / AP mode)
After=network.target
Before=${NODE_SERVICE}.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=root
WorkingDirectory=${PROJECT_DIR}
EnvironmentFile=-${PROJECT_DIR}/.env
ExecStart=/usr/bin/env bash ${PROJECT_DIR}/scripts/startup/startup.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${INIT_SERVICE}

[Install]
WantedBy=multi-user.target
EOF

# ── home-server.service ───────────────────────────────────────────────────────
log "Writing $NODE_SERVICE.service…"
$SUDO tee "$NODE_FILE" > /dev/null <<EOF
[Unit]
Description=Home Server (Node.js)
After=${INIT_SERVICE}.service
Requires=${INIT_SERVICE}.service

[Service]
Type=simple
User=${RUN_USER}
Group=${RUN_GROUP}
WorkingDirectory=${PROJECT_DIR}
EnvironmentFile=-${PROJECT_DIR}/.env
ExecStart=${NODE_BIN} src/server.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${NODE_SERVICE}

[Install]
WantedBy=multi-user.target
EOF

$SUDO systemctl daemon-reload
$SUDO systemctl enable "$INIT_SERVICE"
$SUDO systemctl enable "$NODE_SERVICE"

ok "Services installed."
echo ""
echo "  Boot sequence logs : journalctl -u $INIT_SERVICE -f"
echo "  Node server logs   : journalctl -u $NODE_SERVICE -f"
echo "  Restart both       : systemctl restart $INIT_SERVICE $NODE_SERVICE"
echo "  Disable            : systemctl disable $INIT_SERVICE $NODE_SERVICE"

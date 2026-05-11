#!/usr/bin/env bash
# startup.sh — Boot sequence for the home server on DietPi.
#
# Flow:
#   1. Check if primary WiFi (uGotHacked:)) is in range
#   2. If yes → connect, git pull updates, disconnect
#   3. Start Access Point (lever)
#   4. Node.js server starts via its own systemd unit (After=home-server-init)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

log()  { echo -e "\033[1;34m[startup]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ ok ]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }

# Load env — tolerant, not all vars are required at this point
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

IFACE="${WIFI_IFACE:-wlan0}"
WIFI_SSID="${WIFI_SSID:-uGotHacked:)}"
WIFI_PASS="${WIFI_PASS:-xx7usavf7szhx}"

log "==============================="
log " Home Server — Boot Sequence"
log "==============================="
log "Interface : $IFACE"
log "Project   : $PROJECT_DIR"
echo ""

# ── Step 1: WiFi check + update ───────────────────────────────────────────────
log "[1/2] Checking for primary WiFi…"

if bash "$SCRIPT_DIR/wifi-check-update.sh" \
     "$IFACE" "$WIFI_SSID" "$WIFI_PASS" "$PROJECT_DIR"; then
  ok "Update complete."
else
  warn "Primary WiFi unavailable or update skipped — continuing to AP mode."
fi

echo ""

# ── Step 2: Access Point mode ─────────────────────────────────────────────────
log "[2/2] Starting Access Point…"
bash "$SCRIPT_DIR/ap-mode.sh" "$IFACE"
ok "AP is up. Clients can now connect."

echo ""
log "Startup sequence done — Node.js service will start momentarily."

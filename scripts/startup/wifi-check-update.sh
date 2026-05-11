#!/usr/bin/env bash
# wifi-check-update.sh — Scan for the primary WiFi, connect, run git pull,
#                        then cleanly disconnect so ap-mode.sh can take over.
#
# Args : <interface> <ssid> <password> <project_dir>
# Exit : 0 = updated successfully | 1 = SSID not found | 2 = other failure

set -uo pipefail

IFACE="${1:?'arg 1: interface required (e.g. wlan0)'}"
SSID="${2:?'arg 2: WiFi SSID required'}"
PASS="${3:?'arg 3: WiFi password required'}"
PROJECT_DIR="${4:?'arg 4: project directory required'}"

log()  { echo -e "\033[1;34m[wifi]\033[0m $*"; }
warn() { echo -e "\033[1;33m[wifi]\033[0m $*"; }
fail() { echo -e "\033[1;31m[wifi]\033[0m $*" >&2; }

WPA_CONF="$(mktemp /tmp/wpa-home-XXXXXX.conf)"

cleanup() {
  # Wipe the temp config — it contains the wifi password
  rm -f "$WPA_CONF"
}
trap cleanup EXIT

# ── 1. Make sure the interface is up ─────────────────────────────────────────
ip link set "$IFACE" up 2>/dev/null || true
sleep 2

# ── 2. Scan (up to 3 attempts) ───────────────────────────────────────────────
log "Scanning for SSID: $SSID"
FOUND=false
for attempt in 1 2 3; do
  # iw scan output: "        SSID: <name>"  (no quotes)
  if iw dev "$IFACE" scan 2>/dev/null | grep -qF "SSID: $SSID"; then
    FOUND=true
    break
  fi
  log "Attempt $attempt: not found, retrying in 4 s…"
  sleep 4
done

if ! $FOUND; then
  warn "SSID '$SSID' not in range — skipping update."
  exit 1
fi

log "SSID found. Connecting…"

# ── 3. Stop any client wpa_supplicant that may already be running ─────────────
pkill -f "wpa_supplicant.*${IFACE}" 2>/dev/null || true
sleep 1

# ── 4. Build wpa_supplicant config (hashed PSK, no plaintext in file) ─────────
wpa_passphrase "$SSID" "$PASS" | grep -v '^\s*#psk' > "$WPA_CONF"

wpa_supplicant -B -D nl80211,wext -i "$IFACE" -c "$WPA_CONF" \
  -P "/var/run/wpa_supplicant-home.pid" 2>/dev/null
sleep 4

# ── 5. Obtain an IP address ───────────────────────────────────────────────────
if command -v dhclient &>/dev/null; then
  dhclient "$IFACE" -timeout 15 2>/dev/null || { fail "dhclient failed"; exit 2; }
elif command -v dhcpcd &>/dev/null; then
  dhcpcd "$IFACE" --timeout 15 2>/dev/null || { fail "dhcpcd failed"; exit 2; }
else
  fail "No DHCP client found (install dhclient or dhcpcd)."
  exit 2
fi

# ── 6. Verify connectivity ────────────────────────────────────────────────────
log "Verifying internet access…"
if ! ping -c 2 -W 6 github.com &>/dev/null; then
  warn "Cannot reach github.com — skipping git pull."
  # Still proceed to clean disconnect; exit 2 to signal partial failure
  _SKIP_PULL=true
else
  _SKIP_PULL=false
fi

# ── 7. Pull updates ───────────────────────────────────────────────────────────
if ! $_SKIP_PULL; then
  log "Pulling latest code from remote…"
  cd "$PROJECT_DIR"
  if git pull --ff-only 2>&1 | while IFS= read -r line; do log "  git: $line"; done; then
    log "Repository up to date."
  else
    warn "git pull had a non-fatal issue — continuing."
  fi
fi

# ── 8. Cleanly disconnect so AP mode can own the interface ────────────────────
log "Disconnecting client WiFi…"
pkill -f "wpa_supplicant.*${IFACE}" 2>/dev/null || true
dhclient -r "$IFACE" 2>/dev/null || dhcpcd -k "$IFACE" 2>/dev/null || true
ip addr flush dev "$IFACE" 2>/dev/null || true
sleep 1

log "Client WiFi disconnected."
exit 0

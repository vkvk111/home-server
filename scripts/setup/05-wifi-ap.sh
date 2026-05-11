#!/usr/bin/env bash
# 05-wifi-ap.sh — Install and configure hostapd + dnsmasq for AP mode.
#
# Reads AP_SSID / AP_PASS from .env (or uses the defaults below).
# Run once during initial setup, then ap-mode.sh handles runtime.

set -euo pipefail

PROJECT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

log()  { echo -e "\033[1;34m[05-wifi-ap]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ ok ]\033[0m $*"; }

SUDO="${SUDO:-$([ $EUID -eq 0 ] && echo '' || echo 'sudo')}"

# Load .env if present; fall back to known defaults
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

AP_SSID="${AP_SSID:-lever}"
AP_PASS="${AP_PASS:-xx7usavf7szhx}"
AP_IFACE="${WIFI_IFACE:-wlan0}"
AP_IP="192.168.4.1"
DHCP_RANGE_START="192.168.4.10"
DHCP_RANGE_END="192.168.4.50"

# ── 1. Install packages ───────────────────────────────────────────────────────
log "Installing hostapd, dnsmasq, iw, wireless-tools…"
$SUDO apt-get update -qq
$SUDO apt-get install -y --no-install-recommends \
  hostapd dnsmasq iw wireless-tools wpasupplicant

# ── 2. Write /etc/hostapd/hostapd.conf ───────────────────────────────────────
log "Writing hostapd config (SSID: $AP_SSID)…"

$SUDO tee /etc/hostapd/hostapd.conf > /dev/null <<EOF
interface=${AP_IFACE}
driver=nl80211

ssid=${AP_SSID}
hw_mode=g
channel=7
ieee80211n=1
wmm_enabled=1

macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0

wpa=2
wpa_key_mgmt=WPA-PSK
wpa_passphrase=${AP_PASS}
rsn_pairwise=CCMP
EOF

# Point the hostapd daemon to the config
$SUDO sed -i 's|^#\?DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' \
  /etc/default/hostapd 2>/dev/null || true

# ── 3. Write /etc/dnsmasq.d/home-server.conf ─────────────────────────────────
log "Writing dnsmasq config…"

$SUDO tee /etc/dnsmasq.d/home-server.conf > /dev/null <<EOF
# Only listen on the AP interface
interface=${AP_IFACE}
bind-interfaces

# DHCP pool
dhcp-range=${DHCP_RANGE_START},${DHCP_RANGE_END},255.255.255.0,24h

# Resolve 'home.server' to the Pi's AP IP for convenience
address=/home.server/${AP_IP}
EOF

# Disable dnsmasq autostart — startup.sh controls it
$SUDO systemctl disable dnsmasq 2>/dev/null || true
$SUDO systemctl unmask  hostapd 2>/dev/null || true
$SUDO systemctl disable hostapd 2>/dev/null || true

ok "WiFi AP config written."
log "  SSID : $AP_SSID"
log "  IP   : $AP_IP"
log "  DHCP : $DHCP_RANGE_START – $DHCP_RANGE_END"

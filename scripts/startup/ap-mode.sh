#!/usr/bin/env bash
# ap-mode.sh — Configure wlan0 as an Access Point.
#
# Requires hostapd and dnsmasq configured by 05-wifi-ap.sh.
# The AP SSID/password live in /etc/hostapd/hostapd.conf.
#
# Args: <interface>  (default: wlan0)

set -euo pipefail

IFACE="${1:-wlan0}"
AP_IP="192.168.4.1"
AP_PREFIX="24"

log()  { echo -e "\033[1;34m[ap-mode]\033[0m $*"; }
warn() { echo -e "\033[1;33m[ap-mode]\033[0m $*"; }

# ── 1. Stop anything that might conflict with hostapd ─────────────────────────
log "Stopping client WiFi processes on $IFACE…"
# Tell NetworkManager to stop managing wlan0 only — keeps eth0 alive for SSH
mkdir -p /etc/NetworkManager/conf.d
cat > /etc/NetworkManager/conf.d/unmanage-wlan0.conf <<'EOF'
[keyfile]
unmanaged-devices=interface-name:wlan0
EOF
systemctl reload NetworkManager 2>/dev/null || systemctl restart NetworkManager 2>/dev/null || true
sleep 1
# Disconnect wlan0 from any active connection
nmcli device disconnect "$IFACE"    2>/dev/null || true
pkill -f "wpa_supplicant.*${IFACE}" 2>/dev/null || true
pkill -f "dhclient.*${IFACE}"       2>/dev/null || true

# ── 2. Assign static IP ───────────────────────────────────────────────────────
log "Assigning $AP_IP/$AP_PREFIX to $IFACE…"
ip link set "$IFACE" up
ip addr flush dev "$IFACE"
ip addr add "${AP_IP}/${AP_PREFIX}" dev "$IFACE"

# ── 3. Start hostapd ──────────────────────────────────────────────────────────
log "Starting hostapd…"
# hostapd is masked by default on some systems — unmask silently
systemctl unmask hostapd 2>/dev/null || true
systemctl start hostapd

# ── 4. Start dnsmasq ──────────────────────────────────────────────────────────
log "Starting dnsmasq…"
systemctl restart dnsmasq

log "AP mode active — $IFACE @ $AP_IP"

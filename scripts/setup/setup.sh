#!/usr/bin/env bash
# setup.sh — Main setup entry point for the home server on DietPi.
#
# DietPi runs as root by default. This script handles both root and
# a non-root user with sudo. Run from the project root:
#   bash scripts/setup/setup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

log()  { echo -e "\033[1;34m[setup]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ ok ]\033[0m $*"; }
fail() { echo -e "\033[1;31m[FAIL]\033[0m $*" >&2; exit 1; }

# On DietPi the default shell user is root; drop sudo wrapper when already root.
if [[ $EUID -eq 0 ]]; then
  log "Running as root (DietPi default) — sudo not required."
export SUDO=""
else
  command -v sudo &>/dev/null || fail "sudo not found and not running as root."
  export SUDO="sudo"
fi

log "Starting home-server setup (project: $PROJECT_DIR)"
echo ""

STEPS=(
  "01-system-deps.sh"
  "02-node.sh"
  "03-python-deps.sh"
  "05-wifi-ap.sh"        # hostapd + dnsmasq config for AP mode
  # "04-service.sh"      # uncomment to install systemd services
)

for step in "${STEPS[@]}"; do
  log "Running $step …"
  bash "$SCRIPT_DIR/$step" "$PROJECT_DIR" || fail "$step failed"
  ok "$step complete"
  echo ""
done

ok "All setup steps completed."
echo ""
echo "  Start manually : npm start"
echo "  Or install as a service: bash scripts/setup/04-service.sh"

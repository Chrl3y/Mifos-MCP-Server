#!/usr/bin/env bash
# =============================================================================
# One-time setup for a fresh DigitalOcean Droplet (Ubuntu 22.04 / 24.04)
# Run as root or with sudo.
#
# Usage:
#   ssh root@YOUR_DROPLET_IP
#   curl -fsSL https://raw.githubusercontent.com/Chrl3y/Mifos-MCP-Server/local-deploy/scripts/setup-droplet.sh | bash
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/Chrl3y/Mifos-MCP-Server.git"
APP_DIR="$HOME/mifos-mcp-server"

echo "===== [1/6] System update ====="
apt-get update -qq && apt-get upgrade -y -qq

echo "===== [2/6] Install Docker ====="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# docker compose v2 plugin (bundled with Docker Desktop, but needs explicit install on server)
if ! docker compose version &>/dev/null 2>&1; then
  apt-get install -y docker-compose-plugin
fi

echo "===== [3/6] Clone repo ====="
if [ -d "$APP_DIR/.git" ]; then
  echo "Repo already cloned — pulling..."
  cd "$APP_DIR"
  git fetch origin local-deploy
  git reset --hard origin/local-deploy
else
  git clone -b local-deploy "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "===== [4/6] Create .env ====="
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo ""
  echo "⚠️  IMPORTANT: Edit $APP_DIR/.env before starting the stack!"
  echo "   Fill in: FINERACT_BASE_URL, AT_API_KEY, AT_USERNAME, etc."
  echo ""
fi

echo "===== [5/6] Open firewall ports ====="
# UFW: allow SSH + webhook port + dashboard port
if command -v ufw &>/dev/null; then
  ufw allow OpenSSH
  ufw allow 4000/tcp comment "Mifos webhook server"
  ufw allow 3001/tcp comment "Mifos dashboard"
  ufw --force enable
fi

echo "===== [6/6] Add deploy SSH key placeholder ====="
echo ""
echo "To enable GitHub Actions auto-deploy, run these steps:"
echo ""
echo "  # On your LOCAL machine — generate a dedicated deploy keypair:"
echo "  ssh-keygen -t ed25519 -C 'github-actions-deploy' -f ~/.ssh/mifos_deploy -N ''"
echo ""
echo "  # Copy public key to this Droplet:"
echo "  ssh-copy-id -i ~/.ssh/mifos_deploy.pub root@$(curl -s ifconfig.me)"
echo ""
echo "  # Then add these GitHub Secrets to your repo:"
echo "  #  DO_HOST            = $(curl -s ifconfig.me)"
echo "  #  DO_SSH_USER        = root"
echo "  #  DO_SSH_PRIVATE_KEY = (contents of ~/.ssh/mifos_deploy)"
echo ""
echo "===== Setup complete ====="
echo ""
echo "Next: edit .env then run:"
echo "  cd $APP_DIR && docker compose up -d --build"
echo ""
echo "Webhook endpoint will be:  http://$(curl -s ifconfig.me):4000/webhook"
echo "Dashboard will be:         http://$(curl -s ifconfig.me):3001"

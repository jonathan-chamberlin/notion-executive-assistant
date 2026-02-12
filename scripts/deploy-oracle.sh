#!/bin/bash
# Deploy Kalshi Weather Trading Bot to Oracle Cloud Free Tier
#
# Prerequisites:
#   1. Create an Oracle Cloud account (cloud.oracle.com)
#   2. Create an Always Free ARM Ampere A1 instance:
#      - Shape: VM.Standard.A1.Flex (1 OCPU, 1 GB RAM is plenty)
#      - Image: Canonical Ubuntu 22.04 Minimal aarch64
#      - Add your SSH key
#   3. Open port 22 in the security list (SSH only, no other ports needed)
#   4. SSH into the instance: ssh ubuntu@<public-ip>
#
# Then run this script:
#   curl -fsSL https://raw.githubusercontent.com/<your-repo>/main/scripts/deploy-oracle.sh | bash
#   OR
#   bash scripts/deploy-oracle.sh
#
# After running, create .env and start:
#   cp .env.example .env
#   nano .env  # fill in your secrets
#   docker compose up -d kalshi-trader
#   docker compose logs -f kalshi-trader

set -euo pipefail

echo "=== Kalshi Weather Bot — Oracle Cloud Setup ==="

# 1. Update system
echo "Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install Docker
echo "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to log out and back in for group changes."
fi

# 3. Install Docker Compose plugin
echo "Installing Docker Compose..."
if ! docker compose version &> /dev/null; then
    sudo apt-get install -y docker-compose-plugin
fi

# 4. Clone repo (or use existing)
REPO_DIR="$HOME/kalshi-trader"
if [ ! -d "$REPO_DIR" ]; then
    echo "Cloning repository..."
    git clone https://github.com/jonathan-chamberlin/notion-executive-assistant.git "$REPO_DIR"
else
    echo "Repository exists, pulling latest..."
    cd "$REPO_DIR" && git pull
fi

cd "$REPO_DIR"

# 5. Create .env if missing
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "=== ACTION REQUIRED ==="
    echo "Edit .env with your secrets:"
    echo "  nano $REPO_DIR/.env"
    echo ""
    echo "Required variables:"
    echo "  KALSHI_API_KEY_ID     — from kalshi.com/account/api-keys"
    echo "  KALSHI_PRIVATE_KEY_PEM — paste your RSA private key PEM content"
    echo "  TELEGRAM_BOT_TOKEN    — from @BotFather"
    echo "  TELEGRAM_CHAT_ID      — your Telegram user/chat ID"
    echo ""
    echo "Then start the bot:"
    echo "  cd $REPO_DIR"
    echo "  docker compose up -d kalshi-trader"
    echo "  docker compose logs -f kalshi-trader"
else
    echo ".env already exists"
fi

# 6. Build and start
echo ""
echo "Building Docker image..."
docker compose build kalshi-trader

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start:  docker compose up -d kalshi-trader"
echo "To logs:   docker compose logs -f kalshi-trader"
echo "To stop:   docker compose down"
echo "To update: git pull && docker compose build kalshi-trader && docker compose up -d kalshi-trader"

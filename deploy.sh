#!/bin/bash
# CRM Omnichannel — VPS Deployment Script
# Target: Debian 12 @ 10.10.101.207
# FusionPBX: 10.10.101.189

set -e

echo "=== CRM Deployment Script ==="
echo ""

# ─── Step 1: Install Docker ───
echo "[1/6] Installing Docker..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker
systemctl start docker
echo "  Docker installed: $(docker --version)"

# ─── Step 2: Create project directory ───
echo "[2/6] Setting up project directory..."
mkdir -p /opt/crm
cd /opt/crm

# ─── Step 3: Create production .env ───
echo "[3/6] Creating production environment..."
cat > .env << 'ENVEOF'
# Database
DB_USER=crm_user
DB_PASSWORD=CrmStr0ng!Pass2026
DB_NAME=crm_db
DATABASE_URL=postgresql://crm_user:CrmStr0ng!Pass2026@postgres:5432/crm_db

# Redis
REDIS_URL=redis://redis:6379

# JWT — CHANGE THESE in production!
JWT_ACCESS_SECRET=crm-jwt-access-$(openssl rand -hex 16)
JWT_REFRESH_SECRET=crm-jwt-refresh-$(openssl rand -hex 16)

# Server
PORT=4000
NODE_ENV=production
FRONTEND_URL=http://10.10.101.207
APP_PORT=80

# FusionPBX (via private network)
ESL_ENABLED=true
ESL_HOST=10.10.101.189
ESL_PORT=8021
ESL_PASSWORD=ClueCon
FUSIONPBX_RECORDING_URL=http://10.10.101.189:8088/recordings

# FusionPBX Presence Polling (primary PG, SSH fallback). Set FUSIONPBX_IP once the server is ready.
SIP_PRESENCE_ENABLED=true
FUSIONPBX_IP=10.10.101.189
FUSIONPBX_PG_USER=fusionpbx_readonly
FUSIONPBX_PG_PASSWORD=
FUSIONPBX_PG_DB=fusionpbx
FUSIONPBX_PG_PORT=5432
FUSIONPBX_PG_SSL=false
FUSIONPBX_SSH_USER=root
FUSIONPBX_SSH_PASSWORD=

# Webhook
WEBHOOK_ALLOWED_IPS=10.10.101.189,127.0.0.1
WEBHOOK_BASIC_USER=webhook
WEBHOOK_BASIC_PASS=$(openssl rand -hex 12)
ENVEOF

# Re-source to expand variables
source .env
echo "  Environment configured"

# ─── Step 4: Clone/copy project ───
echo "[4/6] Copying project files..."
echo "  NOTE: You need to copy the project to /opt/crm"
echo "  From your local machine, run:"
echo "    scp -r . root@10.10.101.207:/opt/crm/"
echo ""
echo "  Or if using git:"
echo "    git clone <your-repo-url> /opt/crm"
echo ""

# ─── Step 5: Build and start ───
echo "[5/6] Building and starting containers..."
if [ -f "docker-compose.prod.yml" ]; then
  docker compose -f docker-compose.prod.yml up -d --build
  echo "  Containers started"
else
  echo "  ERROR: docker-compose.prod.yml not found!"
  echo "  Copy the project first, then run:"
  echo "    cd /opt/crm && docker compose -f docker-compose.prod.yml up -d --build"
  exit 1
fi

# ─── Step 6: Run migrations + seed ───
echo "[6/6] Running database migrations..."
sleep 10  # Wait for postgres to be ready
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec -e NODE_ENV=development backend npx prisma db seed
echo "  Database migrated and seeded"

echo ""
echo "=== Deployment Complete ==="
echo "  CRM URL: http://10.10.101.207"
echo "  Login:   admin@crm.local / changeme123"
echo ""
echo "  FusionPBX ESL: 10.10.101.189:8021"
echo "  CDR Webhook URL: http://10.10.101.207/api/v1/webhooks/cdr"
echo ""
echo "  Manage: docker compose -f docker-compose.prod.yml logs -f"
echo "  Stop:   docker compose -f docker-compose.prod.yml down"

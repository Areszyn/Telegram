#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_var() {
  local name=$1
  local val="${!name}"
  if [ -z "$val" ]; then
    echo -e "${RED}ERROR: $name is not set. Add it to Replit Secrets.${NC}"
    exit 1
  fi
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

echo -e "${GREEN}=== Lifegram Bot — Cloudflare Deploy ===${NC}"
echo ""

echo -e "${YELLOW}Checking required environment variables...${NC}"
check_var "BOT_TOKEN"
check_var "ADMIN_ID"
check_var "CLOUDFLARE_API_TOKEN"
check_var "CLOUDFLARE_ACCOUNT_ID"
check_var "D1_DATABASE_ID"
check_var "R2_BUCKET_NAME"
check_var "R2_PUBLIC_URL"
check_var "R2_ACCESS_KEY_ID"
check_var "R2_SECRET_ACCESS_KEY"
check_var "OXAPAY_MERCHANT_KEY"
check_var "TELEGRAM_API_ID"
check_var "TELEGRAM_API_HASH"
check_var "MTPROTO_API_KEY"

APP_DOMAIN="${APP_DOMAIN:-mini.susagar.sbs}"
MINIAPP_URL="${MINIAPP_URL:-https://lifegram-miniapp.pages.dev/}"
# Ensure MINIAPP_URL ends with /
[[ "$MINIAPP_URL" != */ ]] && MINIAPP_URL="${MINIAPP_URL}/"
WORKER_NAME="${WORKER_NAME:-lifegram-api}"
ZONE_NAME="${ZONE_NAME:-susagar.sbs}"
D1_DATABASE_NAME="${D1_DATABASE_NAME:-lifegram}"
CF_PAGES_PROJECT="${CF_PAGES_PROJECT:-lifegram-miniapp}"

echo -e "${GREEN}All required variables set.${NC}"
echo ""
echo "  APP_DOMAIN:      $APP_DOMAIN"
echo "  MINIAPP_URL:     $MINIAPP_URL"
echo "  WORKER_NAME:     $WORKER_NAME"
echo "  ZONE_NAME:       $ZONE_NAME"
echo "  D1_DATABASE_ID:  ${D1_DATABASE_ID:0:8}..."
echo "  R2_BUCKET_NAME:  $R2_BUCKET_NAME"
echo ""

WORKER_DIR="$(cd "$(dirname "$0")/../artifacts/api-server" && pwd)"
WRANGLER_TOML="$WORKER_DIR/wrangler.toml"

echo -e "${YELLOW}Generating wrangler.toml...${NC}"
cat > "$WRANGLER_TOML" << EOF
name = "$WORKER_NAME"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

routes = [
  { pattern = "$APP_DOMAIN/api/*", zone_name = "$ZONE_NAME" },
  { pattern = "$APP_DOMAIN/miniapp/*", zone_name = "$ZONE_NAME" },
  { pattern = "$APP_DOMAIN/miniapp", zone_name = "$ZONE_NAME" },
]

[[d1_databases]]
binding = "DB"
database_name = "$D1_DATABASE_NAME"
database_id = "$D1_DATABASE_ID"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "$R2_BUCKET_NAME"

[triggers]
crons = ["*/2 * * * *"]

[vars]
NODE_ENV = "production"
APP_DOMAIN = "$APP_DOMAIN"
MINIAPP_URL = "$MINIAPP_URL"
EOF

echo -e "${GREEN}wrangler.toml generated.${NC}"
echo ""

if [ -n "${CLOUDFLARE_API_TOKEN2:-}" ]; then
  export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN2"
fi

echo -e "${YELLOW}Pushing secrets to Cloudflare Worker...${NC}"
SECRETS_FAILED=0
push_secret() {
  local name=$1
  local val="${!name}"
  if echo "$val" | (cd "$WORKER_DIR" && pnpm exec wrangler secret put "$name" --name "$WORKER_NAME" 2>&1) | grep -q "Success"; then
    echo -e "  ${GREEN}✓ $name${NC}"
  else
    echo -e "  ${RED}✗ $name FAILED${NC}"
    SECRETS_FAILED=1
  fi
}

push_secret "BOT_TOKEN"
push_secret "ADMIN_ID"
push_secret "OXAPAY_MERCHANT_KEY"
push_secret "R2_PUBLIC_URL"
push_secret "R2_ACCESS_KEY_ID"
push_secret "R2_SECRET_ACCESS_KEY"
push_secret "TELEGRAM_API_ID"
push_secret "TELEGRAM_API_HASH"
push_secret "MTPROTO_API_KEY"

if [ -z "${MTPROTO_BACKEND_URL:-}" ]; then
  if [ -n "${REPLIT_DEV_DOMAIN:-}" ]; then
    export MTPROTO_BACKEND_URL="https://${REPLIT_DEV_DOMAIN}"
    echo -e "  ${YELLOW}Auto-detected MTPROTO_BACKEND_URL from Replit: $MTPROTO_BACKEND_URL${NC}"
  elif [ -n "${REPLIT_DOMAINS:-}" ]; then
    export MTPROTO_BACKEND_URL="https://${REPLIT_DOMAINS}"
    echo -e "  ${YELLOW}Auto-detected MTPROTO_BACKEND_URL from Replit: $MTPROTO_BACKEND_URL${NC}"
  fi
fi
if [ -n "${MTPROTO_BACKEND_URL:-}" ]; then
  push_secret "MTPROTO_BACKEND_URL"
else
  echo -e "${RED}  WARNING: MTPROTO_BACKEND_URL could not be detected. Set it manually later.${NC}"
fi

if [ "$SECRETS_FAILED" -eq 1 ]; then
  echo -e "${RED}ERROR: One or more secrets failed to upload. Aborting deploy.${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}Deploying Worker...${NC}"
(cd "$WORKER_DIR" && pnpm exec wrangler deploy)

echo ""
echo -e "${GREEN}=== Worker deployed! ===${NC}"
echo ""

if [ "${DEPLOY_MINIAPP:-}" = "true" ]; then
  echo -e "${YELLOW}Building Mini App...${NC}"
  MINIAPP_DIR="$(cd "$(dirname "$0")/../artifacts/miniapp" && pwd)"
  (cd "$MINIAPP_DIR" && BASE_PATH=/ VITE_API_URL="https://$APP_DOMAIN/api" PORT=3000 NODE_ENV=production pnpm run build)

  DIST_DIR="/tmp/miniapp-dist-$$"
  rm -rf "$DIST_DIR"
  cp -r "$MINIAPP_DIR/dist/public" "$DIST_DIR" 2>/dev/null || cp -r "$MINIAPP_DIR/dist" "$DIST_DIR"

  echo -e "${YELLOW}Deploying Mini App to Cloudflare Pages...${NC}"
  (cd "$WORKER_DIR" && GIT_DIR=/tmp/fake-git pnpm exec wrangler pages deploy "$DIST_DIR" \
    --project-name "$CF_PAGES_PROJECT" --branch main --commit-dirty=true)

  rm -rf "$DIST_DIR"
  echo -e "${GREEN}=== Mini App deployed! ===${NC}"
fi

echo ""
echo -e "${GREEN}=== All done! ===${NC}"
echo ""
echo "Worker:   https://$APP_DOMAIN/api/health"
echo "Mini App: $MINIAPP_URL"
if [ -n "${MTPROTO_BACKEND_URL:-}" ]; then
  echo "MTProto:  $MTPROTO_BACKEND_URL/mtproto/health"
fi

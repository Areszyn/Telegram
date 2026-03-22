#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
ROOT_ENV="$SCRIPT_DIR/../../.env"

if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
elif [ -f "$ROOT_ENV" ]; then
  set -a; source "$ROOT_ENV"; set +a
fi

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_API_TOKEN2:-}" ]; then
  export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN2"
fi

MTPROTO_URL="${1:-${MTPROTO_BACKEND_URL:-}}"

if [ -z "$MTPROTO_URL" ]; then
  echo -e "${RED}Usage: ./deploy-and-link.sh <YOUR_BACKEND_URL>${NC}"
  echo ""
  echo "Examples:"
  echo "  ./deploy-and-link.sh https://myapp.railway.app"
  echo "  ./deploy-and-link.sh https://myapp.koyeb.app"
  echo "  ./deploy-and-link.sh https://myapp.fly.dev"
  echo "  ./deploy-and-link.sh https://my-vps.example.com"
  exit 1
fi

MTPROTO_URL="${MTPROTO_URL%/}"

echo -e "${GREEN}=== Link MTProto Backend to Cloudflare Worker ===${NC}"
echo ""
echo "  Backend URL: $MTPROTO_URL"
echo ""

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo -e "${RED}ERROR: CLOUDFLARE_API_TOKEN not set. Add it to .env or export it.${NC}"
  exit 1
fi

WORKER_NAME="${WORKER_NAME:-lifegram-api}"

echo -e "${YELLOW}Testing backend health...${NC}"
HEALTH=$(curl -sf "$MTPROTO_URL/mtproto/health" 2>/dev/null || curl -sf "$MTPROTO_URL/health" 2>/dev/null || echo "")

if echo "$HEALTH" | grep -q "ok"; then
  echo -e "  ${GREEN}✓ Backend is healthy${NC}"
else
  echo -e "  ${YELLOW}⚠ Could not reach $MTPROTO_URL — setting secret anyway${NC}"
fi

echo -e "${YELLOW}Pushing MTPROTO_BACKEND_URL to Cloudflare Worker...${NC}"
if echo "$MTPROTO_URL" | npx wrangler secret put MTPROTO_BACKEND_URL --name "$WORKER_NAME" 2>&1 | grep -q "Success"; then
  echo -e "  ${GREEN}✓ MTPROTO_BACKEND_URL set to $MTPROTO_URL${NC}"
else
  echo -e "  ${RED}✗ Failed to set secret${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}=== Done! Worker will now proxy MTProto requests to: $MTPROTO_URL ===${NC}"

#!/bin/bash
# ============================================================
# Lifegram Bot — Cloudflare Deploy Script
# ============================================================
# Usage:
#   bash scripts/deploy.sh                  # deploy worker only
#   bash scripts/deploy.sh --miniapp        # deploy worker + miniapp
#   bash scripts/deploy.sh --landing        # deploy worker + landing
#   bash scripts/deploy.sh --all            # deploy everything
#   bash scripts/deploy.sh --push-secrets   # also sync secrets to worker
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# --- Parse flags ---
DEPLOY_WORKER=true
DEPLOY_MINIAPP=false
DEPLOY_LANDING=false
PUSH_SECRETS=false
for arg in "$@"; do
  case "$arg" in
    --miniapp)      DEPLOY_MINIAPP=true ;;
    --landing)      DEPLOY_LANDING=true ;;
    --all)          DEPLOY_MINIAPP=true; DEPLOY_LANDING=true ;;
    --push-secrets) PUSH_SECRETS=true ;;
    --no-worker)    DEPLOY_WORKER=false ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKER_DIR="$ROOT_DIR/artifacts/api-server"
MINIAPP_DIR="$ROOT_DIR/artifacts/miniapp"
LANDING_DIR="$ROOT_DIR/artifacts/landing"

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Lifegram Bot — Cloudflare Deploy         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# --- Resolve the best Cloudflare API token ---
# CLOUDFLARE_API_TOKEN2 takes priority (has Cloudflare Pages permissions)
if [ -n "${CLOUDFLARE_API_TOKEN2:-}" ]; then
  export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN2"
  echo -e "${GREEN}✓ Using CLOUDFLARE_API_TOKEN2${NC}"
elif [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo -e "${YELLOW}Using CLOUDFLARE_API_TOKEN (limited permissions)${NC}"
else
  echo -e "${RED}ERROR: No Cloudflare API token found. Set CLOUDFLARE_API_TOKEN or CLOUDFLARE_API_TOKEN2 in Secrets.${NC}"
  exit 1
fi

# --- Config from env (all have defaults from .replit userenv) ---
APP_DOMAIN="${APP_DOMAIN:-lifegram-api.areszyn.workers.dev}"
MINIAPP_URL="${MINIAPP_URL:-https://lifegram-miniapp.pages.dev/miniapp/}"
WORKER_NAME="${WORKER_NAME:-lifegram-api}"
ZONE_NAME="${ZONE_NAME:-susagar.sbs}"
CF_PAGES_PROJECT="${CF_PAGES_PROJECT:-lifegram-miniapp}"
CF_PAGES_LANDING_PROJECT="${CF_PAGES_LANDING_PROJECT:-lifegram-landing}"

echo ""
echo -e "${YELLOW}Deploy targets:${NC}"
echo "  Worker:   $DEPLOY_WORKER  ($WORKER_NAME)"
echo "  Mini App: $DEPLOY_MINIAPP ($CF_PAGES_PROJECT)"
echo "  Landing:  $DEPLOY_LANDING ($CF_PAGES_LANDING_PROJECT)"
echo "  Secrets:  $PUSH_SECRETS"
echo ""

# --- Optional: push secrets from Replit Secrets to Cloudflare Worker ---
if [ "$PUSH_SECRETS" = true ]; then
  echo -e "${YELLOW}Pushing secrets to Cloudflare Worker...${NC}"

  push_secret() {
    local name=$1
    local val="${!name:-}"
    if [ -z "$val" ]; then
      echo -e "  ${YELLOW}⚠ $name not set in Replit Secrets — skipping${NC}"
      return
    fi
    if echo "$val" | (cd "$WORKER_DIR" && pnpm exec wrangler secret put "$name" --name "$WORKER_NAME" 2>&1) | grep -q "Success"; then
      echo -e "  ${GREEN}✓ $name${NC}"
    else
      echo -e "  ${RED}✗ $name FAILED${NC}"
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
  push_secret "AI_KEY_ENCRYPTION_SECRET"

  # Auto-detect MTProto backend URL from Koyeb or Replit
  if [ -z "${MTPROTO_BACKEND_URL:-}" ] && [ -n "${REPLIT_DEV_DOMAIN:-}" ]; then
    export MTPROTO_BACKEND_URL="https://${REPLIT_DEV_DOMAIN}/mtproto"
    echo -e "  ${YELLOW}Auto-set MTPROTO_BACKEND_URL: $MTPROTO_BACKEND_URL${NC}"
  fi
  push_secret "MTPROTO_BACKEND_URL"

  echo ""
fi

# --- Deploy Worker ---
if [ "$DEPLOY_WORKER" = true ]; then
  echo -e "${YELLOW}Deploying Cloudflare Worker ($WORKER_NAME)...${NC}"
  (cd "$WORKER_DIR" && pnpm exec wrangler deploy)
  echo -e "${GREEN}✓ Worker deployed → https://$APP_DOMAIN/api/health${NC}"
  echo ""
fi

# --- Deploy Mini App to Cloudflare Pages ---
if [ "$DEPLOY_MINIAPP" = true ]; then
  echo -e "${YELLOW}Building Mini App...${NC}"
  (cd "$MINIAPP_DIR" && \
    BASE_PATH=/miniapp/ \
    VITE_API_URL="https://$APP_DOMAIN/api" \
    NODE_ENV=production \
    pnpm run build)

  DIST="/tmp/miniapp-dist-$$"
  rm -rf "$DIST"
  cp -r "$MINIAPP_DIR/dist/public" "$DIST"

  echo -e "${YELLOW}Deploying Mini App to Pages ($CF_PAGES_PROJECT)...${NC}"
  FAKE_GIT="/tmp/fake-git-$$"
  mkdir -p "$FAKE_GIT/.git/refs/heads"
  echo "ref: refs/heads/main" > "$FAKE_GIT/.git/HEAD"
  printf '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n' > "$FAKE_GIT/.git/config"
  (cd "$WORKER_DIR" && GIT_DIR="$FAKE_GIT/.git" pnpm exec wrangler pages deploy "$DIST" \
    --project-name "$CF_PAGES_PROJECT" --branch main --commit-dirty=true)
  rm -rf "$FAKE_GIT"

  rm -rf "$DIST"
  echo -e "${GREEN}✓ Mini App deployed → https://lifegram-miniapp.pages.dev/miniapp/${NC}"
  echo ""
fi

# --- Deploy Landing Page to Cloudflare Pages ---
if [ "$DEPLOY_LANDING" = true ]; then
  echo -e "${YELLOW}Building Landing Page...${NC}"
  (cd "$LANDING_DIR" && NODE_ENV=production pnpm run build)

  DIST="/tmp/landing-dist-$$"
  rm -rf "$DIST"
  cp -r "$LANDING_DIR/dist/public" "$DIST"

  echo -e "${YELLOW}Deploying Landing to Pages ($CF_PAGES_LANDING_PROJECT)...${NC}"
  FAKE_GIT2="/tmp/fake-git2-$$"
  mkdir -p "$FAKE_GIT2/.git/refs/heads"
  echo "ref: refs/heads/main" > "$FAKE_GIT2/.git/HEAD"
  printf '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n' > "$FAKE_GIT2/.git/config"
  (cd "$WORKER_DIR" && GIT_DIR="$FAKE_GIT2/.git" pnpm exec wrangler pages deploy "$DIST" \
    --project-name "$CF_PAGES_LANDING_PROJECT" --branch main --commit-dirty=true)
  rm -rf "$FAKE_GIT2"

  rm -rf "$DIST"
  echo -e "${GREEN}✓ Landing deployed → https://areszyn.org${NC}"
  echo ""
fi

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Deploy complete!                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
if [ "$DEPLOY_WORKER" = true ];  then echo "  Worker:   https://$APP_DOMAIN/api/health"; fi
if [ "$DEPLOY_MINIAPP" = true ]; then echo "  Mini App: https://lifegram-miniapp.pages.dev/miniapp/"; fi
if [ "$DEPLOY_LANDING" = true ]; then echo "  Landing:  https://areszyn.org"; fi
echo ""

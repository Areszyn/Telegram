#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
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

WORKER_NAME="${WORKER_NAME:-lifegram-api}"
APP_NAME="${APP_NAME:-mtproto-backend}"

link_to_cloudflare() {
  local url="$1"
  url="${url%/}"

  echo ""
  echo -e "${CYAN}Testing backend health...${NC}"
  HEALTH=$(curl -sf "$url/mtproto/health" 2>/dev/null || curl -sf "$url/health" 2>/dev/null || echo "")

  if echo "$HEALTH" | grep -q "ok"; then
    echo -e "  ${GREEN}✓ Backend is healthy at $url${NC}"
  else
    echo -e "  ${YELLOW}⚠ Could not reach $url — setting secret anyway${NC}"
  fi

  if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    echo -e "${YELLOW}⚠ CLOUDFLARE_API_TOKEN not set — skipping Cloudflare link${NC}"
    echo -e "  Run manually: ${BOLD}echo '$url' | npx wrangler secret put MTPROTO_BACKEND_URL --name $WORKER_NAME${NC}"
    return
  fi

  echo -e "${CYAN}Pushing MTPROTO_BACKEND_URL to Cloudflare Worker...${NC}"
  if echo "$url" | npx wrangler secret put MTPROTO_BACKEND_URL --name "$WORKER_NAME" 2>&1 | grep -q "Success"; then
    echo -e "  ${GREEN}✓ MTPROTO_BACKEND_URL → $url${NC}"
  else
    echo -e "  ${RED}✗ Failed to push secret. Run manually:${NC}"
    echo -e "  ${BOLD}echo '$url' | npx wrangler secret put MTPROTO_BACKEND_URL --name $WORKER_NAME${NC}"
  fi
}

check_env() {
  if [ -z "${MTPROTO_API_KEY:-}" ]; then
    echo -e "${RED}ERROR: MTPROTO_API_KEY is required.${NC}"
    echo -e "Set it in .env or export it: ${BOLD}export MTPROTO_API_KEY=your_key${NC}"
    exit 1
  fi
}

deploy_railway() {
  check_env
  echo -e "${GREEN}=== Deploying to Railway ===${NC}"
  echo ""

  if ! command -v railway &>/dev/null; then
    echo -e "${YELLOW}Installing Railway CLI...${NC}"
    npm i -g @railway/cli
  fi

  cd "$SCRIPT_DIR"

  if ! railway status &>/dev/null 2>&1; then
    echo -e "${CYAN}Creating Railway project...${NC}"
    railway init --name "$APP_NAME"
  fi

  echo -e "${CYAN}Setting environment variables...${NC}"
  railway variables set MTPROTO_API_KEY="$MTPROTO_API_KEY"
  railway variables set PORT=3003

  echo -e "${CYAN}Deploying...${NC}"
  railway up --detach

  echo -e "${CYAN}Getting deployment URL...${NC}"
  sleep 5
  RAILWAY_URL=$(railway domain 2>/dev/null || echo "")

  if [ -z "$RAILWAY_URL" ]; then
    echo -e "${YELLOW}Generating public domain...${NC}"
    RAILWAY_URL=$(railway domain --json 2>/dev/null | grep -o '"domain":"[^"]*"' | cut -d'"' -f4 || echo "")
  fi

  if [ -n "$RAILWAY_URL" ]; then
    [[ "$RAILWAY_URL" != https://* ]] && RAILWAY_URL="https://$RAILWAY_URL"
    echo -e "${GREEN}✓ Deployed to: $RAILWAY_URL${NC}"
    link_to_cloudflare "$RAILWAY_URL"
  else
    echo -e "${YELLOW}Could not auto-detect URL. Check Railway dashboard and run:${NC}"
    echo -e "  ${BOLD}bash deploy.sh link https://your-app.railway.app${NC}"
  fi
}

deploy_fly() {
  check_env
  echo -e "${GREEN}=== Deploying to Fly.io ===${NC}"
  echo ""

  if ! command -v flyctl &>/dev/null && ! command -v fly &>/dev/null; then
    echo -e "${YELLOW}Installing Fly CLI...${NC}"
    curl -L https://fly.io/install.sh | sh
    export PATH="$HOME/.fly/bin:$PATH"
  fi

  FLY=$(command -v flyctl 2>/dev/null || command -v fly)
  cd "$SCRIPT_DIR"

  if ! $FLY apps list 2>/dev/null | grep -q "$APP_NAME"; then
    echo -e "${CYAN}Creating Fly app...${NC}"
    $FLY apps create "$APP_NAME" --org personal 2>/dev/null || true
  fi

  echo -e "${CYAN}Setting secrets...${NC}"
  $FLY secrets set MTPROTO_API_KEY="$MTPROTO_API_KEY" --app "$APP_NAME"

  echo -e "${CYAN}Deploying...${NC}"
  $FLY deploy --app "$APP_NAME" --remote-only

  FLY_URL="https://${APP_NAME}.fly.dev"
  echo -e "${GREEN}✓ Deployed to: $FLY_URL${NC}"
  link_to_cloudflare "$FLY_URL"
}

deploy_koyeb() {
  check_env
  echo -e "${GREEN}=== Deploying to Koyeb ===${NC}"
  echo ""

  if ! command -v koyeb &>/dev/null; then
    echo -e "${YELLOW}Installing Koyeb CLI...${NC}"
    curl -fsSL https://raw.githubusercontent.com/koyeb/koyeb-cli/master/install.sh | sh
  fi

  cd "$SCRIPT_DIR"

  echo -e "${CYAN}Deploying...${NC}"
  koyeb app create "$APP_NAME" 2>/dev/null || true
  koyeb service create "$APP_NAME" \
    --app "$APP_NAME" \
    --docker "." \
    --port 3003:http \
    --env "MTPROTO_API_KEY=$MTPROTO_API_KEY" \
    --env "PORT=3003" \
    --checks '3003:http:/health' \
    2>/dev/null || \
  koyeb service update "$APP_NAME/$APP_NAME" \
    --docker "." \
    --env "MTPROTO_API_KEY=$MTPROTO_API_KEY"

  KOYEB_URL="https://${APP_NAME}.koyeb.app"
  echo -e "${GREEN}✓ Deployed to: $KOYEB_URL${NC}"
  link_to_cloudflare "$KOYEB_URL"
}

deploy_render() {
  check_env
  echo -e "${GREEN}=== Deploying to Render ===${NC}"
  echo ""
  echo -e "${CYAN}Render deploys via Git or render.yaml blueprint.${NC}"
  echo ""
  echo -e "  1. Push this folder to a Git repo"
  echo -e "  2. Go to ${BOLD}https://dashboard.render.com/select-repo?type=web${NC}"
  echo -e "  3. Connect your repo, Render will auto-detect render.yaml"
  echo -e "  4. Add env var: ${BOLD}MTPROTO_API_KEY${NC}"
  echo -e "  5. Deploy, then run:"
  echo -e "     ${BOLD}bash deploy.sh link https://your-app.onrender.com${NC}"
}

deploy_docker() {
  check_env
  echo -e "${GREEN}=== Building Docker Image ===${NC}"
  echo ""

  cd "$SCRIPT_DIR"
  IMAGE_NAME="${DOCKER_IMAGE:-mtproto-backend}"

  echo -e "${CYAN}Building image: $IMAGE_NAME ...${NC}"
  docker build -t "$IMAGE_NAME" .
  echo -e "  ${GREEN}✓ Image built: $IMAGE_NAME${NC}"

  echo ""
  echo -e "${BOLD}Run locally:${NC}"
  echo -e "  docker run -d --restart=always -p 3003:3003 \\"
  echo -e "    -e MTPROTO_API_KEY=your_key \\"
  echo -e "    --name $APP_NAME $IMAGE_NAME"
  echo ""
  echo -e "${BOLD}Push to registry:${NC}"
  echo -e "  docker tag $IMAGE_NAME your-registry/$IMAGE_NAME"
  echo -e "  docker push your-registry/$IMAGE_NAME"
  echo ""
  echo -e "${BOLD}Then link:${NC}"
  echo -e "  bash deploy.sh link https://your-server.com"
}

deploy_vps() {
  check_env
  echo -e "${GREEN}=== VPS Deploy Guide ===${NC}"
  echo ""
  echo -e "${BOLD}Option A: Docker (recommended)${NC}"
  echo -e "  scp -r $SCRIPT_DIR user@your-vps:/opt/$APP_NAME"
  echo -e "  ssh user@your-vps 'cd /opt/$APP_NAME && docker build -t $APP_NAME . && \\"
  echo -e "    docker run -d --restart=always -p 3003:3003 \\"
  echo -e "    -e MTPROTO_API_KEY=your_key --name $APP_NAME $APP_NAME'"
  echo ""
  echo -e "${BOLD}Option B: Node.js directly${NC}"
  echo -e "  scp -r $SCRIPT_DIR user@your-vps:/opt/$APP_NAME"
  echo -e "  ssh user@your-vps 'cd /opt/$APP_NAME && npm install && \\"
  echo -e "    MTPROTO_API_KEY=your_key PORT=3003 npx tsx src/index.ts'"
  echo ""
  echo -e "${BOLD}Option C: systemd service${NC}"
  echo -e "  Create /etc/systemd/system/$APP_NAME.service:"
  echo ""
  echo -e "  [Unit]"
  echo -e "  Description=MTProto Backend"
  echo -e "  After=network.target"
  echo ""
  echo -e "  [Service]"
  echo -e "  Type=simple"
  echo -e "  WorkingDirectory=/opt/$APP_NAME"
  echo -e "  Environment=PORT=3003"
  echo -e "  Environment=MTPROTO_API_KEY=your_key"
  echo -e "  ExecStart=/usr/bin/npx tsx src/index.ts"
  echo -e "  Restart=always"
  echo ""
  echo -e "  [Install]"
  echo -e "  WantedBy=multi-user.target"
  echo ""
  echo -e "${BOLD}Nginx reverse proxy (HTTPS):${NC}"
  echo ""
  echo -e "  server {"
  echo -e "    listen 443 ssl;"
  echo -e "    server_name mtproto.yourdomain.com;"
  echo -e "    ssl_certificate /etc/letsencrypt/live/mtproto.yourdomain.com/fullchain.pem;"
  echo -e "    ssl_certificate_key /etc/letsencrypt/live/mtproto.yourdomain.com/privkey.pem;"
  echo -e "    location / {"
  echo -e "      proxy_pass http://127.0.0.1:3003;"
  echo -e "      proxy_set_header Host \$host;"
  echo -e "      proxy_set_header X-Real-IP \$remote_addr;"
  echo -e "    }"
  echo -e "  }"
  echo ""
  echo -e "${BOLD}After setup, link to Cloudflare:${NC}"
  echo -e "  bash deploy.sh link https://mtproto.yourdomain.com"
}

show_help() {
  echo -e "${GREEN}${BOLD}MTProto Backend — Deploy Anywhere${NC}"
  echo ""
  echo -e "${BOLD}Usage:${NC}"
  echo -e "  bash deploy.sh ${CYAN}<platform>${NC}        Deploy to a platform"
  echo -e "  bash deploy.sh ${CYAN}link <url>${NC}        Link existing deployment to Cloudflare"
  echo ""
  echo -e "${BOLD}Platforms:${NC}"
  echo -e "  ${CYAN}railway${NC}     Deploy to Railway (auto-detect URL)"
  echo -e "  ${CYAN}fly${NC}         Deploy to Fly.io"
  echo -e "  ${CYAN}koyeb${NC}       Deploy to Koyeb"
  echo -e "  ${CYAN}render${NC}      Guide for Render (Git-based deploy)"
  echo -e "  ${CYAN}docker${NC}      Build Docker image (push anywhere)"
  echo -e "  ${CYAN}vps${NC}         Full VPS guide (Docker/Node/systemd/nginx)"
  echo ""
  echo -e "${BOLD}Link to Cloudflare:${NC}"
  echo -e "  bash deploy.sh link https://your-app.railway.app"
  echo -e "  bash deploy.sh link https://your-app.fly.dev"
  echo -e "  bash deploy.sh link https://your-vps.com"
  echo ""
  echo -e "${BOLD}Environment:${NC}"
  echo -e "  Required:  ${CYAN}MTPROTO_API_KEY${NC}         (auth key for the backend)"
  echo -e "  Optional:  ${CYAN}CLOUDFLARE_API_TOKEN${NC}    (for auto-linking to Worker)"
  echo -e "  Optional:  ${CYAN}PORT${NC}                    (default: 3003)"
  echo ""
  echo -e "  Set in .env file or export before running."
}

case "${1:-help}" in
  railway)  deploy_railway ;;
  fly)      deploy_fly ;;
  koyeb)    deploy_koyeb ;;
  render)   deploy_render ;;
  docker)   deploy_docker ;;
  vps)      deploy_vps ;;
  link)
    if [ -z "${2:-}" ]; then
      echo -e "${RED}Usage: bash deploy.sh link <YOUR_BACKEND_URL>${NC}"
      echo -e "Example: bash deploy.sh link https://myapp.railway.app"
      exit 1
    fi
    echo -e "${GREEN}=== Link MTProto Backend to Cloudflare Worker ===${NC}"
    link_to_cloudflare "$2"
    echo ""
    echo -e "${GREEN}=== Done! Worker will now proxy MTProto requests to: $2 ===${NC}"
    ;;
  help|--help|-h|"")  show_help ;;
  *)
    echo -e "${RED}Unknown platform: $1${NC}"
    echo ""
    show_help
    exit 1
    ;;
esac

# MTProto Backend

Standalone MTProto session backend for Lifegram Bot. Deploy anywhere, then run `deploy-and-link.sh` to connect it to the Cloudflare Worker.

## Quick Start

### 1. Copy the `.env` file
```bash
cp ../../.env .env
# Or create one with just:
echo "MTPROTO_API_KEY=your_key_here" > .env
```

### 2. Deploy to any platform

#### Railway
```bash
railway init
railway up
# Get your URL from Railway dashboard, then:
./deploy-and-link.sh https://your-app.railway.app
```

#### Fly.io
```bash
fly launch --no-deploy
fly secrets set MTPROTO_API_KEY=your_key
fly deploy
./deploy-and-link.sh https://your-app.fly.dev
```

#### Koyeb
```bash
koyeb app create mtproto-backend
koyeb service create mtproto --app mtproto-backend --docker . --port 3003 --env MTPROTO_API_KEY=your_key
./deploy-and-link.sh https://mtproto-backend-your-id.koyeb.app
```

#### Render
Push to GitHub, create a new Web Service from the repo, set `MTPROTO_API_KEY` env var.
```bash
./deploy-and-link.sh https://your-app.onrender.com
```

#### VPS (any Linux server)
```bash
git clone <repo> && cd artifacts/mtproto-backend
cp ../../.env .env  # or create one
npm install
npx tsx src/index.ts &
./deploy-and-link.sh https://your-domain.com
```

#### Docker (anywhere)
```bash
docker build -t mtproto-backend .
docker run -d -p 3003:3003 --env-file .env mtproto-backend
./deploy-and-link.sh https://your-domain.com
```

### 3. That's it
The `deploy-and-link.sh` script pushes `MTPROTO_BACKEND_URL` to your Cloudflare Worker automatically. No manual Cloudflare dashboard needed.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MTPROTO_API_KEY` | Yes | Shared secret between Worker and this backend |
| `PORT` | No | Server port (default: 3003) |
| `CLOUDFLARE_API_TOKEN` | For linking | Needed by `deploy-and-link.sh` to set Worker secret |
| `WORKER_NAME` | For linking | Cloudflare Worker name (default: lifegram-api) |

## Health Check

```
GET /health → {"ok":true}
```

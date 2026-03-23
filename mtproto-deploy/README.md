# MTProto Backend

Telegram MTProto user-client backend for Lifegram. Handles session auth, group participants, profile management, and messaging via Telegram's MTProto protocol.

## Deploy on Render

1. Create a new GitHub repo and push this code
2. Go to [Render Dashboard](https://dashboard.render.com) → New → Web Service
3. Connect your GitHub repo
4. Render will auto-detect `render.yaml` — just set the environment variable:
   - `MTPROTO_API_KEY` — a secret key to authenticate API requests

That's it. Render will build and deploy automatically on every push.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MTPROTO_API_KEY` | Yes | Secret key for API authentication (set any strong random string) |
| `PORT` | No | Server port (default: 3003) |

## API Endpoints

All endpoints (except `/health`) require `x-api-key` header matching `MTPROTO_API_KEY`.

- `GET /health` — Health check
- `POST /mtproto/auth/start` — Start phone auth (send code)
- `POST /mtproto/auth/verify` — Verify code + optional 2FA
- `POST /mtproto/info` — Get account info
- `POST /mtproto/chats` — List chats/dialogs
- `POST /mtproto/profile` — Update profile (name, username, bio)
- `POST /mtproto/password` — Change/remove 2FA password
- `POST /mtproto/send` — Send a message
- `POST /mtproto/chat-edit` — Edit group title/description
- `POST /mtproto/participants` — Get group/channel members

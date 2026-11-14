# studyabroad-admin — Claude Code Instructions

## Deploy

To deploy after pushing code, trigger the webhook:

```bash
curl -s -X POST "https://paneledu.com/api/deploy?secret=paneledu_deploy_2025" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0" \
  -d '{}'
```

Response `{"ok":true,"message":"Deploy started"}` means the server is pulling the latest code and restarting (Passenger). Allow ~30–60 seconds for the restart.

## Branch

Always develop on: `claude/check-system-availability-WOEF3`

## Stack

- Node.js / Express 4.x on cPanel shared hosting (Phusion Passenger)
- MySQL 8.0.45
- Bootstrap 5.3.2 + Bootstrap Icons 1.11.3
- JWT auth (`middleware/auth.js`) — `requireRole('admin')` on all admin routes
- Cesium.js 1.124 for 3D orbit preview (`public/orbit/index.html`)

## Security rules

- `.env` is gitignored — NEVER commit it
- `DEPLOY_SECRET` lives only in cPanel env vars and this file — never put it in code
- Google Maps API key is in `public/orbit/index.html` — do not commit it elsewhere

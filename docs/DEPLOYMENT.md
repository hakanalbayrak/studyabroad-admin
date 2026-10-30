# Deployment & Server Environment

Production runs on cPanel shared hosting. Key facts that affect how we deploy
and configure things:

## Server
- **Host control panel:** cPanel 136.0 (build 12)
- **Server name:** cp58
- **Shared IP address:** `213.238.183.62`
- **OS:** Linux, x86_64, kernel 6.12 (CloudLinux)
- **Apache:** 2.4.67 (with Passenger for Node.js)
- **Database:** MySQL 8.0.45-cll-lve (CloudLinux build)
- **Path to Sendmail:** `/usr/sbin/sendmail`
- **Node.js:** v20 (via cPanel "Setup Node.js App" / Passenger)

## App layout
- **App root (code):** `/home/matur124/studyabroad.kampanya.website`
- **Primary domain:** `paneledu.com` (addon domain, own document root)
- **Startup file:** `server.js`
- **DB connection:** Unix socket via `DB_SOCKET` env var (avoids
  `127.0.0.1` vs `localhost` grant issues on cPanel)
- **Passenger needs `.htaccess`** in the document root — if it goes missing after
  a fresh clone, recreate it with `PassengerAppRoot`, `PassengerNodejs`,
  `PassengerStartupFile`.

## Environment quirks to remember
- **MySQL does NOT support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`** here.
  Write migrations without `IF NOT EXISTS` on `ADD COLUMN` (it's fine on
  `CREATE TABLE`).
- **JSON body limit raised to 5mb** (`express.json({ limit: '5mb' })`) — large
  universities with many programs exceeded the default 100kb.
- **"Email Deliverability" tool is NOT available** in this cPanel build.
  SPF/DKIM must be managed manually (Zone Editor if DNS is on the server, or at
  the domain registrar/Namecheap if DNS is there).
- **`bcryptjs` / no native modules** — shared hosting can't compile native deps,
  so use pure-JS packages (bcryptjs, not bcrypt).

## Required environment variables (cPanel → Node.js App → Environment variables)
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SOCKET`
- `JWT_SECRET` — random string for signing auth tokens
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — seeds the first admin user on startup
- `SMTP_HOST` (`mail.paneledu.com`), `SMTP_PORT` (`465`), `SMTP_USER`
  (`noreply@paneledu.com`), `SMTP_PASS`
- `NOTIFY_EMAIL` — where new-lead alerts are sent
- `APP_URL` — `https://paneledu.com` (used in email links)

## Deploy steps
1. `cd ~/studyabroad.kampanya.website && git pull origin <branch>`
2. Run any new SQL in `database/` via phpMyAdmin
3. `~/nodevenv/studyabroad.kampanya.website/20/bin/npm install --production`
   (only when dependencies changed)
4. cPanel → Node.js Apps → **Restart**

## Known issue — OTP/transactional email inbox placement (parked, low priority)
- OTP and lead emails **send fine and are Accepted** by recipient servers
  (verified via cPanel → Track Delivery). DNS already has SPF + DKIM (set by
  host cenuta/dnsowner.com — not Namecheap).
- New-domain reputation means Microsoft (live/outlook) and Gmail may route them
  to Junk for now. Warms up over time.
- **Proper fix when needed:** route transactional mail through Brevo/Sendinblue
  SMTP (an account already appears in the mail logs) — just swap the
  `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` env vars, no code change.

## Email deliverability (manual SPF/DKIM — no cPanel tool)
- **SPF** (TXT on `@`): `v=spf1 +mx +a +ip4:213.238.183.62 ~all`
- **DKIM**: cPanel auto-generates a key when a domain is added; the TXT lives at
  `default._domainkey`. It only works if the **authoritative DNS** carries it —
  if DNS is at Namecheap, the cPanel-generated records must be copied there.
- Verify authoritative nameservers with `dig NS paneledu.com +short`.

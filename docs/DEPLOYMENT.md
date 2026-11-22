# DEPLOYMENT

Target for a small restaurant: one Linux server (or VPS) running the API,
PostgreSQL, the Telegram bot and the Mini App; the owner admin panel can run on
the same host. The bot and Mini App need no per-device installs.

> Everything below was exercised locally; an earlier release (bot + Mini App) was
> deployed to the production host. Items marked “not built in this environment”
> (Android APK, Windows `.exe`, Tauri AppImage, Docker image build) remain
> environment-limited.

## 1. Prerequisites

| Component | Version |
|---|---|
| Node.js | 20 LTS or newer |
| PostgreSQL | 15+ (managed or self-hosted) |
| npm | 10+ (workspaces) |
| Reverse proxy | nginx (or Caddy) with TLS |
| OS | Linux x86_64 recommended for the API/web apps |
| Docker (optional) | 24+ with Compose v2 for the bundled deploy files |

Optional legacy build tooling (only for apps under `legacy/`):

- Android Studio / Android SDK **or** an EAS account for the mobile app.
- Windows 10/11 + MSVC + WebView2 for the cashier `.exe`/`.msi`.
- WebKitGTK 4.1 + Rust (for building the Linux cashier app).

## 2. Environment

Copy `.env.example` to `apps/api/.env` (never commit it) and fill in:

```ini
DATABASE_URL="postgresql://ikki:STRONG_PASSWORD@127.0.0.1:5432/ikki_dost?schema=public"
JWT_ACCESS_SECRET="<64+ random chars>"
JWT_REFRESH_SECRET="<64+ random chars>"
JWT_ACCESS_TTL="15m"
JWT_REFRESH_TTL="30d"
PORT=3000
API_PREFIX="api"
CORS_ORIGINS="https://admin.example.uz"
UPLOAD_DIR="uploads"
MINI_APP_DIR="../mini-app/dist"
MAX_IMAGE_SIZE_BYTES=5242880
VAPID_PUBLIC_KEY="<generated>"
VAPID_PRIVATE_KEY="<generated>"
VAPID_SUBJECT="mailto:admin@example.uz"

# Telegram (also used by the API to validate Mini App initData and to send
# registration/verification messages)
BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
BOT_USERNAME="ikkidostbot"
OWNER_TELEGRAM_IDS="7483287151,317080284"
TELEGRAM_AUTH_MAX_AGE_SECONDS=86400
```

The API and the bot must share the same `BOT_TOKEN`; the API rejects Mini App
`initData` and bot-secret requests otherwise.
`OWNER_TELEGRAM_IDS` is a comma-separated allowlist of owner identities; any
Telegram account in this list logs in as OWNER without an extra password.

Bot settings live in `apps/bot/.env` (or the Compose environment):

```ini
BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
BOT_USERNAME="ikkidostbot"
API_URL="https://ikkidost.abitcore.uz/api"
MINI_APP_URL="https://ikkidost.abitcore.uz"
BOT_NOTIFY_INTERVAL_MS=10000
BOT_STORE_PATH="data/sessions.json"
```

`MINI_APP_URL` must be the public HTTPS origin of the API (same domain that
serves `/`) because Telegram requires HTTPS for `webApp` buttons.

Generate secrets:

```bash
openssl rand -hex 48          # JWT secrets
npx web-push generate-vapid-keys
```

Do **not** set `EMBEDDED_PG_PORT` in production; the embedded server is for
local development only.

## 3. Install and build

```bash
git clone <repo> /opt/ikki-dost
cd /opt/ikki-dost
npm ci
npx prisma generate --schema apps/api/prisma/schema.prisma
npm run build -w @ikki-dost/api
npm run build -w @ikki-dost/bot
npm run build -w @ikki-dost/mini-app
npm run build -w @ikki-dost/admin-web      # optional owner panel
```

The API compiles to `apps/api/dist`; the Mini App to `apps/mini-app/dist`; the
bot to `apps/bot/dist`. The API serves the Mini App from `/` when `MINI_APP_DIR`
(default `../mini-app/dist`, relative to `apps/api`) contains `index.html`.

> Next.js resolves the TypeScript sources in `packages/` directly. Keep
> `transpilePackages` in the Next config when editing the admin build.

## 4. Database

```bash
cd /opt/ikki-dost/apps/api
npx prisma migrate deploy     # apply migrations (no data loss)
node --experimental-strip-types scripts/seed.ts   # first install only
```

- Run `seed.ts` once on a fresh database. It is idempotent, but it creates the
  default owner password — change it immediately after go-live.
- Backups: nightly `pg_dump -Fc ikki_dost > /backup/ikki-$(date +%F).dump`,
  retain 30 days, test restores quarterly.
- The database is the only stateful service. Uploaded images live on disk (see
  §7) and must be backed up too.

## 5. Run the API

systemd unit (`/etc/systemd/system/ikki-api.service`):

```ini
[Unit]
Description=Ikki Do'st API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/ikki-dost/apps/api
EnvironmentFile=/opt/ikki-dost/apps/api/.env
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=3
User=ikki
Group=ikki
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ikki-api
sudo systemctl status ikki-api
```

Alternative: `pm2 start apps/api/dist/main.js --name ikki-api --update-env`.

## 6. Run the admin panel (optional)

```bash
# admin (owner) — port 3001
npm run start -w @ikki-dost/admin-web
```

One systemd unit (or PM2 process) with the same `EnvironmentFile` and
`ExecStart=/usr/bin/npm run start -w @ikki-dost/admin-web` is sufficient.

### nginx

```nginx
# Admin
server {
    listen 443 ssl http2;
    server_name admin.example.uz;
    ssl_certificate     /etc/letsencrypt/live/admin.example.uz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.example.uz/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API + Mini App — must proxy WebSocket upgrades for /rt and allow 5 MB uploads
server {
    listen 443 ssl http2;
    server_name ikkidost.abitcore.uz;
    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

Set `CORS_ORIGINS` to the exact web origins. The Mini App is same-origin with
the API, so it needs no extra CORS entry.

## 7. Uploads

- Files are written to `apps/api/uploads` (or `UPLOAD_DIR`). Create the
  directory, give the service user write access, and add it to backups
  (`rsync`/restic).
- Serve production uploads through the same nginx `location /uploads/` proxy to
  the API, or a `root` alias to the directory.
- Product images are re-encoded to WebP with generated thumbnails; only the
  upload directory needs persistence.

## 8. Mini App (customer + staff web UI)

Build and serve:

```bash
npm run build -w @ikki-dost/mini-app
# served automatically by the API at https://<domain>/ from apps/mini-app/dist
```

- `MINI_APP_DIR` overrides the build location (default `../mini-app/dist`
  relative to the API working directory).
- The API keeps `/api`, `/api/docs`, `/uploads` and `/rt` intact; every other
  GET falls back to `index.html` for client-side routing.
- Helmet CSP allows `https://telegram.org` scripts and Telegram Web iframes. If
  you add external assets, extend `scriptSrc`/`imgSrc` in `apps/api/src/main.ts`.
- Customer flow: menu → mandatory registration + phone verification → delivery
  order with per-item kitchen notes → cart with fee preview → submit → 5 s
  status tracker + printable e-receipt. Dine-in guests call a waiter instead of
  ordering remotely.
- Staff flow: OWNER can create employees (including DELIVERY) and assign
  Telegram IDs in the Mini App owner tab. The Mini App validates Telegram
  `initData` and the bot uses the Telegram sender ID; the assigned employee role
  selects the staff screen. No staff role uses a password. OWNER opens on the
  normal customer screen and enters the owner panel through the “Ega” tab.

Public endpoints used by the Mini App are documented in `docs/API.md` and are
throttled at the API level.

## 9. Telegram bot

1. Create a bot with @BotFather and copy the token.
2. Set `BOT_TOKEN`, `BOT_USERNAME`, `API_URL`, and `MINI_APP_URL` in
   `apps/bot/.env` (or the Compose environment). Set the same `BOT_TOKEN` in the
   API environment — it validates Mini App `initData` and bot-secret calls. Never
   commit the token.
3. Start it:

```bash
npm run build -w @ikki-dost/bot
cd apps/bot && npm start
```

or with the Compose profile:

```bash
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env \
  --profile bot up -d bot
```

4. In @BotFather, set the Mini App / menu button to `MINI_APP_URL`
   (`/setmenubutton` or Bot Settings → Menu Button). The bot also sends a
   `webApp` button in its home keyboard.
5. On first setup, bootstrap the owner from the Mini App's owner sign-in, then
  assign the owner's own Telegram ID and employee IDs in the Owner tab. Staff
  press `/start` to see their ID; after the owner assigns it to the correct
  employee record, they press `/start` again to log in. Sessions persist in
  `apps/bot/data/sessions.json` (gitignored, mount a volume in production).
  Customer registration and phone verification also happen in the bot;
  delivery checkout can request location, and ordering is Mini App only.

The bot uses long polling — no inbound port or webhook is required. Without a
valid token it exits with a clear error; a token cannot be generated locally.

## 10. Docker Compose (bundled deploy)

`deploy/ikki-dost/` contains:

- `compose.yaml` — `api` (also serves the Mini App), `db`, and an optional
  `bot` profile;
- `nginx.conf` / `nginx-http.conf` — TLS and ACME bootstrap for
  `ikkidost.abitcore.uz`;
- `.env.example`, `set-bot-token.sh`, `README.md`.

```bash
cp deploy/ikki-dost/.env.example deploy/ikki-dost/.env
# fill in POSTGRES_PASSWORD, JWT secrets, SEED_* passwords,
# BOT_TOKEN, BOT_USERNAME and TELEGRAM_AUTH_MAX_AGE_SECONDS
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env \
  up -d --build api db
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env \
  exec api sh -c 'cd apps/api && node --experimental-strip-types scripts/seed.ts'
```

`Dockerfile.deploy` builds the API, bot and Mini App; PostgreSQL data and
uploads use named volumes. The image was reviewed but not built in this
environment (no Docker daemon).

## 11. Legacy clients

The original `chef-web`, `mobile` and `cashier-desktop` apps live under
`legacy/`. They still build with their original commands but are superseded by
the bot + Mini App and are not part of the default deploy path.

## 12. Legacy mobile app (Expo / Android)

Development:

```bash
cd legacy/mobile
EXPO_PUBLIC_API_URL="http://<LAN-IP>:3000/api" npx expo start
```

- Android emulator: default fallback is `http://10.0.2.2:3000/api`.
- Physical device: use the server's LAN IP or public HTTPS URL.
- The app is limited to OWNER and WAITER; other roles are rejected at login.

Production build (requires Android SDK or EAS):

```bash
cd legacy/mobile
npx eas-cli login
npx eas-cli build --platform android --profile production
# → AAB for Play Store, APK for sideloading
```

Local APK (wizard-friendly):

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

**Not built in this environment:** no Android SDK is installed, so no APK/AAB
was produced. The JavaScript bundle was validated with
`npx expo export --platform android --no-bytecode` (926 modules, 1.57 MB).

## 13. Legacy cashier desktop (Tauri 2)

Development:

```bash
npm run dev:cashier            # legacy workspace if still wired
npx tauri dev                  # inside a desktop window
```

Linux build (verified before the move):

```bash
cd legacy/cashier-desktop
npx tauri build
```

Produced in this environment:

- `src-tauri/target/release/ikki-dost-cashier` — 11 MB executable
- `src-tauri/target/release/bundle/deb/Ikki Do'st Kassir_0.1.0_amd64.deb`
- `src-tauri/target/release/bundle/rpm/Ikki Do'st Kassir-0.1.0-1.x86_64.rpm`

The AppImage step failed because the `linuxdeploy-plugin-appimage` download was
blocked in this environment. It is a packaging-only failure; the binary and
`.deb`/`.rpm` are usable. Retry on a machine with network access or install
`linuxdeploy`/`appimagetool` locally.

Windows `.exe` / `.msi` (must be built on Windows, not cross-compiled here):

```powershell
cd legacy\cashier-desktop
npm install
npx tauri build
# → src-tauri\target\release\bundle\nsis\...-setup.exe
# → src-tauri\target\release\bundle\msi\..._x64_en-US.msi
```

Install WebView2 (bundled by the Windows installer) and point the app at the
production API before building (`EXPO`-style env does not apply; edit the
cashier app's API base URL / runtime setting).

## 14. First-run checklist

1. Apply migrations and seed.
2. Log in to admin-web as `owner`; immediately change the owner password and
   create real staff accounts.
3. Set the service fee (default 4 000 UZS/person) and decide dine-in/delivery
   applicability.
4. Upload product images, confirm the 14 seeded products and prices.
5. Configure rooms.
6. Create the Telegram bot, set `BOT_TOKEN` + `BOT_USERNAME` on both API and bot,
   set `MINI_APP_URL`, and check the Mini App button on a phone and on Telegram
   Desktop/Web.
7. Register a customer (first/last name + Telegram contact), place a delivery
   order, verify the kitchen note, tracker and printable e-receipt, then claim
   and deliver it as `kuryer`.
8. Verify staff bot flows: Telegram auto-login (passwordless for every role),
   `/rooms`, `/kitchen`, `/delivery`, `/newdel`, `/dash`. Confirm the owner also
   logs in without a password, opens the Mini App on the customer screen, and
   reaches the owner panel via the “Ega” tab.
9. Verify that a browser (non-Telegram) session can only browse the menu and
   cannot register or order.
10. Test a cashier payment + reversal and a room close with/without debt.
11. Verify backups and restore on a staging database.

## 15. Operations

- **Updates:** `git pull && npm ci && npm run build -w @ikki-dost/api && npm run build -w @ikki-dost/bot && npm run build -w @ikki-dost/mini-app`, then
  `npx prisma migrate deploy` and restart services. Keep `BOT_TOKEN` /
  `BOT_USERNAME` identical on API and bot. Migrations are forward-only; take a
  backup first. This rollout adds `20261113005418_delivery_cash_handover`
  (delivery cash fields + `Customer.deliveryAddress`) on top of the
  Telegram-auth/DELIVERY migrations.
- **Logs:** `journalctl -u ikki-api -f` and `journalctl -u ikki-bot -f`;
  Next.js logs via PM2/systemd.
- **Monitoring:** probe `GET /api/health` (200) and the panel URLs; alert on 5xx
  rates and disk usage (uploads + PostgreSQL).
- **Scaling:** the API is stateless except for Socket.IO; run one instance or
  add a Socket.IO adapter (Redis) before scaling horizontally. ADR-008 assumes
  a single node initially.
- **Security:** HTTPS everywhere, strong secrets, restricted `CORS_ORIGINS`,
  firewall the database port, keep Node/PostgreSQL patched, rotate VAPID keys
  only with a re-subscribe plan. Never expose the bot data volume or `.env`.

## 16. Rollback

1. Stop the API.
2. Restore the pre-deploy database dump.
3. Check out the previous release tag, rebuild, restart.
4. The mobile/desktop clients are backward-compatible within a minor version;
   avoid destructive API changes without a new client release.

## 16. Automatic deploy (GitHub Actions)

`.github/workflows/deploy.yml` deploys the server on every push to `main` that touches the API, bot, Mini App, shared packages or
deploy files. Desktop-cashier-only changes do not redeploy the server.

The job SSHes to the server and runs `deploy/ikki-dost/remote-deploy.sh <sha>`:
database dump (last 10 kept in `~/ikki-dost-backups`), copy of the current code in
`~/ikki-dost.prev`, download of the commit from GitHub, sync into `~/ikki-dost`
(never touching `deploy/ikki-dost/.env`, uploads or bot sessions), rebuild of
`api` + `bot`, health check, and **automatic rollback** to the previous code if
the API does not come up.

One-time setup — repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | server IP / hostname used for SSH |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | private key of a key pair whose public half is in the server's `~/.ssh/authorized_keys` |
| `DEPLOY_PORT` | optional, default 22 |

Without these secrets the workflow only prints a warning and skips the deploy.

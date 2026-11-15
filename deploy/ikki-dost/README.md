# Ikki Do'st server deploy

The API is served at `https://ikkidost.abitcore.uz/api`; Swagger is at
`https://ikkidost.abitcore.uz/api/docs`. The same container serves the Telegram
Mini App at `https://ikkidost.abitcore.uz/`. PostgreSQL, uploads and bot
sessions use named volumes. The bot is an optional Compose profile and stays
off until a Telegram token is configured.

## First deploy

Run commands from `/home/deploy/ikki-dost` on the server:

```sh
cp deploy/ikki-dost/.env.example deploy/ikki-dost/.env
chmod 600 deploy/ikki-dost/.env
```

Replace the three placeholder passwords with unique values. Use hexadecimal
secrets for `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`;
for example, generate each with `openssl rand -hex 32`. Set `SEED_OWNER_PASSWORD`
and `SEED_PASSWORD` to unique login passwords before seeding.

Start the API and database:

```sh
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env up -d --build api db
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env exec api sh -c 'cd apps/api && node --experimental-strip-types scripts/seed.ts'
```

Seed only once on a new database. The owner login name is `owner`; the owner
password is the value of `SEED_OWNER_PASSWORD`.

## Deploy updates

After pulling a new commit, rebuild and recreate the API container. The Mini
App is built into this image, so restarting an existing container without
`--build` leaves the previous frontend bundle in place:

```sh
git pull --ff-only
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env up -d --build --force-recreate api
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env ps
curl -fsSI https://ikkidost.abitcore.uz/ | grep -i cache-control
```

The Mini App HTML entrypoint is sent with `no-store`; content-hashed JS/CSS
assets are immutable and can be cached safely. The standalone admin-web is not
included in this API image and requires its own deployment target if used.

## HTTPS proxy

The deploy process first copies `nginx-http.conf` to
`/opt/AbitCore.uz/deploy/nginx/ikkidost.conf`, then adds an include for that
file to the existing `active.conf` and reloads the nginx container. After the
HTTP health check succeeds, request a Let's Encrypt certificate:

```sh
docker exec deploy-certbot-1 certbot certonly --webroot -w /var/www/certbot --register-unsafely-without-email --agree-tos -d ikkidost.abitcore.uz
```

Replace the HTTP-only config with `nginx.conf`, test and reload nginx:

```sh
docker exec deploy-nginx-1 nginx -t
docker exec deploy-nginx-1 nginx -s reload
```

## Start the bot

Set `BOT_TOKEN` in `deploy/ikki-dost/.env` without sharing it in chat, then:

```sh
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env --profile bot up -d --build bot
```

`API_URL` and `MINI_APP_URL` are already set to
`https://ikkidost.abitcore.uz/api` and `https://ikkidost.abitcore.uz`. In
@BotFather, set the bot's menu button / Mini App URL to the same origin so
customers can open the self-service UI. The Mini App is built into the API
image; no extra static host is needed.

## Owner IDs and employee setup

Add `OWNER_TELEGRAM_IDS=7483287151,317080284` to `deploy/ikki-dost/.env`.
On first setup, open the Mini App in Telegram and use the owner bootstrap login
with the seeded owner account. In the Owner tab, create staff accounts with
their role (including DELIVERY) and Telegram ID. Staff can get their numeric ID
by pressing `/start` in the bot; after the owner saves it, they press `/start`
again and are logged in automatically. Non-owner staff do not use usernames or
passwords to sign in. Both configured owner IDs still require the OWNER password.

Check services and API health:

```sh
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env ps
curl -fsS https://ikkidost.abitcore.uz/api/health
```

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

Check services and API health:

```sh
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env ps
curl -fsS https://ikkidost.abitcore.uz/api/health
```

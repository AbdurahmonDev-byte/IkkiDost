#!/usr/bin/env bash
# Server-side deploy, run by GitHub Actions over SSH:
#   ssh deploy@server 'bash -s' -- <commit-sha> < deploy/ikki-dost/remote-deploy.sh
#
# The server checkout (~/ikki-dost) is a plain copy, not a git clone. This script:
#   1. backs up the database (keeps the last 10 dumps),
#   2. keeps a copy of the current code for rollback (~/ikki-dost.prev),
#   3. downloads the commit from GitHub and syncs it in (.env, uploads and
#      bot sessions are never touched),
#   4. rebuilds api + bot only (db and other projects on the server are left alone),
#   5. checks /api/health and rolls back automatically if it fails.
set -euo pipefail

SHA="${1:?commit sha kerak}"
REPO="AbdurahmonDev-byte/IkkiDost"
APP="$HOME/ikki-dost"
PREV="$HOME/ikki-dost.prev"
BACKUPS="$HOME/ikki-dost-backups"
ENV_FILE="deploy/ikki-dost/.env"
EXCLUDES=(--exclude "$ENV_FILE" --exclude 'apps/api/uploads/' --exclude 'apps/bot/data/' --exclude 'node_modules/' --exclude 'backups/')

dc() { (cd "$APP" && docker compose -f deploy/ikki-dost/compose.yaml --env-file "$ENV_FILE" "$@"); }
healthy() {
  docker exec ikki-dost-api node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1
}
wait_healthy() {
  for _ in $(seq 1 40); do healthy && return 0; sleep 3; done
  return 1
}

echo "▶ Deploy $SHA"
[ -f "$APP/$ENV_FILE" ] || { echo "❌ $APP/$ENV_FILE topilmadi"; exit 1; }
mkdir -p "$BACKUPS"

echo "▶ 1/5 Baza zaxirasi"
DUMP="$BACKUPS/db-$(date +%Y%m%d-%H%M%S)-${SHA:0:7}.sql.gz"
docker exec ikki-dost-db pg_dump -U ikki_dost ikki_dost | gzip > "$DUMP"
[ "$(stat -c %s "$DUMP")" -gt 1000 ] || { echo "❌ Baza zaxirasi bo‘sh chiqdi — deploy to‘xtatildi"; exit 1; }
ls -1t "$BACKUPS"/db-*.sql.gz | tail -n +11 | xargs -r rm -f
echo "   $DUMP"

echo "▶ 2/5 Joriy kod nusxasi (rollback uchun)"
mkdir -p "$PREV"
rsync -a --delete "${EXCLUDES[@]}" "$APP/" "$PREV/"

echo "▶ 3/5 Yangi kodni yuklash"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$SHA" | tar xz -C "$TMP" --strip-components=1
cp "$APP/$ENV_FILE" "$TMP/env.keep"
rsync -a --delete "${EXCLUDES[@]}" --exclude 'env.keep' "$TMP/" "$APP/"
cmp -s "$TMP/env.keep" "$APP/$ENV_FILE" || { echo "❌ .env o‘zgarib qoldi"; exit 1; }
grep -q '^CASHIER_KIOSK=' "$APP/$ENV_FILE" || printf '\nCASHIER_KIOSK=on\n' >> "$APP/$ENV_FILE"

echo "▶ 4/5 api va botni qayta yig‘ish"
dc --profile bot up -d --build api bot

echo "▶ 5/5 Tekshiruv"
if wait_healthy; then
  echo "✅ API ishlayapti ($SHA)"
  docker ps --filter name=ikki-dost --format '   {{.Names}}\t{{.Status}}'
  if ! curl -fsS -m 10 -o /dev/null https://ikkidost.abitcore.uz/api/health; then
    echo "⚠️  Tashqaridan https://ikkidost.abitcore.uz ochilmayapti — nginx'dagi ikkidost blokini tekshiring"
  fi
  exit 0
fi

echo "❌ Yangi versiya ishga tushmadi — oldingi kodga qaytarilmoqda"
docker logs --tail 60 ikki-dost-api || true
rsync -a --delete "${EXCLUDES[@]}" "$PREV/" "$APP/"
dc --profile bot up -d --build api bot
if wait_healthy; then
  echo "↩️  Oldingi versiya tiklandi. Baza zaxirasi: $DUMP"
else
  echo "‼️  Oldingi versiya ham ishga tushmadi. Baza zaxirasi: $DUMP"
fi
exit 1

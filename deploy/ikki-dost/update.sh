#!/usr/bin/env bash
# Updates the production stack (API + Mini App + bot) from git.
#
# Run on the server from the repository checkout:
#   bash deploy/ikki-dost/update.sh            # deploys main
#   bash deploy/ikki-dost/update.sh <branch>   # deploys another branch
#
# Steps: pull the branch, back up the database, make sure the desktop cashier
# switch exists in .env, rebuild and restart api + bot, then check /api/health.
# The api container applies Prisma migrations on start.
set -euo pipefail

BRANCH="${1:-main}"
cd "$(dirname "$0")/../.."
ENV_FILE=deploy/ikki-dost/.env
DOCKER="${DOCKER:-docker}"   # use DOCKER="sudo docker" if your user is not in the docker group
dc() { $DOCKER compose -f deploy/ikki-dost/compose.yaml --env-file "$ENV_FILE" "$@"; }

[ -f "$ENV_FILE" ] || { echo "❌ $ENV_FILE topilmadi"; exit 1; }

echo "▶ Kod yangilanmoqda: $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "▶ Baza zaxirasi olinmoqda"
mkdir -p backups
if dc ps --status running db >/dev/null 2>&1 && dc exec -T db pg_isready -U ikki_dost >/dev/null 2>&1; then
  dc exec -T db pg_dump -U ikki_dost ikki_dost | gzip > "backups/ikki_dost-$(date +%Y%m%d-%H%M%S).sql.gz"
  ls -1t backups | head -3
else
  echo "⚠️  db konteyneri ishlamayapti — zaxira o‘tkazib yuborildi"
fi

if ! grep -q '^CASHIER_KIOSK=' "$ENV_FILE"; then
  echo "▶ Kassa terminali yoqilmoqda (CASHIER_KIOSK=on)"
  printf '\n# Desktop cashier opens without login (see .env.example)\nCASHIER_KIOSK=on\n' >> "$ENV_FILE"
fi

echo "▶ api va bot qayta yig‘ilmoqda"
dc --profile bot up -d --build api bot

echo "▶ Tekshiruv"
for i in $(seq 1 30); do
  if dc exec -T api node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    echo "✅ API ishlayapti"
    dc ps
    exit 0
  fi
  sleep 3
done
echo "❌ API javob bermadi. Loglar: $DOCKER compose -f deploy/ikki-dost/compose.yaml logs --tail=100 api"
exit 1

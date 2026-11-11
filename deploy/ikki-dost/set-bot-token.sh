#!/usr/bin/env bash
set -eu

if [ ! -r /dev/tty ]; then
  echo "Run this script from an interactive terminal." >&2
  exit 1
fi

printf 'Telegram BOT_TOKEN (input hidden): ' >/dev/tty
IFS= read -r -s token </dev/tty
printf '\n' >/dev/tty
if [ -z "$token" ] || ! printf '%s' "$token" | grep -Eq '^[A-Za-z0-9:_-]+$'; then
  unset token
  echo "Token is empty or contains unsupported characters" >&2
  exit 2
fi

file="$(dirname "$0")/.env"
test -f "$file" || { echo "Missing deploy/ikki-dost/.env" >&2; exit 1; }
chmod 600 "$file"
tmp="${file}.tmp"
awk '!/^BOT_TOKEN=/' "$file" > "$tmp"
printf 'BOT_TOKEN=%s\n' "$token" >> "$tmp"
chmod 600 "$tmp"
mv "$tmp" "$file"
unset token

docker compose -f "$(dirname "$0")/compose.yaml" --env-file "$file" --profile bot up -d --build bot
echo "Bot container started; use docker logs --tail 40 ikki-dost-bot to verify."

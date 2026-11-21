# Topshiriq: Ikki Do‘st yangi versiyasini serverga chiqarish

> Bu faylni kompyuterdagi AI agentga (opencode) to‘liq bering. Agent SSH orqali
> serverga kiradi va quyidagi qadamlarni **tartib bilan** bajaradi. Har bir qadam
> natijasini tekshiradi; kutilmagan narsa chiqsa — to‘xtab, foydalanuvchidan so‘raydi.

## Kontekst (nima qilingan)

Kod GitHub’da ochiq repo: `AbdurahmonDev-byte/IkkiDost`, branch
`claude/kind-gates-x8rs0j`. Bu branchda (serverdagi eski versiyaga nisbatan):

1. **API (`apps/api`)** — yangi `POST /api/auth/kiosk`: Windows/Linux kassa ilovasi
   login/parolsiz `kassa` (CASHIER) hisobi bilan kiradi. Faqat `.env` da
   `CASHIER_KIOSK=on` bo‘lsa ishlaydi; ixtiyoriy `CASHIER_KIOSK_KEY` (header
   `x-kiosk-key`). Baza sxemasi o‘zgarmagan (yangi migratsiya yo‘q).
2. **Telegram bot (`apps/bot`)** — kassa uslubi: Zal / Saboy / Bugungi kassa,
   xona cheki, mavjud hisobga qo‘shish, to‘lov (to‘liq, qisman, naqd qaytim),
   to‘lovdan keyin xonani yopish, aniq kg/litr, oshpazga izoh.
3. **Kassa ilovasi (`legacy/cashier-desktop`)** — serverga deploy qilinmaydi
   (GitHub Actions MSI va AppImage yig‘adi). Faqat serverda kiosk yoqilishi kerak.
4. `deploy/ikki-dost/compose.yaml` ga `CASHIER_KIOSK` va `CASHIER_KIOSK_KEY`
   o‘zgaruvchilari qo‘shilgan.

API testlari 55/55 o‘tgan; bot va kassa lokal API bilan sinab ko‘rilgan.

## Server holati (foydalanuvchi ko‘rsatgan)

- SSH: foydalanuvchi `deploy` (parolni foydalanuvchidan so‘rang, faylga yozmang).
- Loyiha: `/home/deploy/ikki-dost` — **git emas**, fayllar nusxalangan.
- Sozlamalar: `/home/deploy/ikki-dost/deploy/ikki-dost/.env` (**tegmang**, faqat
  qator qo‘shish mumkin).
- Konteynerlar (docker `sudo` siz ishlaydi): `ikki-dost-api`, `ikki-dost-bot`,
  `ikki-dost-db` (compose: `deploy/ikki-dost/compose.yaml`, bot `bot` profilida).
- Serverda boshqa loyihalar ham bor (`deploy-*`, `luxenstore-*`, `abitcore-ai-*` …) —
  **ularga tegmang**, faqat `ikki-dost-*` bilan ishlang.

## Qadamlar

### 1. Zaxira

```bash
cd ~ && tar czf ikki-dost-src-backup-$(date +%Y%m%d-%H%M).tar.gz ikki-dost
docker exec ikki-dost-db pg_dump -U ikki_dost ikki_dost | gzip > ~/ikki-dost-db-$(date +%Y%m%d-%H%M).sql.gz
ls -lh ~/ikki-dost-db-*.sql.gz | tail -1
```

Baza zaxirasi 0 bayt yoki juda kichik bo‘lsa — **to‘xtang**.

### 2. Yangi kodni yuklash

```bash
rm -rf /tmp/ikki-new && mkdir /tmp/ikki-new
curl -fsSL https://codeload.github.com/AbdurahmonDev-byte/IkkiDost/tar.gz/refs/heads/claude/kind-gates-x8rs0j \
  | tar xz -C /tmp/ikki-new --strip-components=1
ls /tmp/ikki-new/apps
```

### 3. compose.yaml farqini tekshirish

```bash
diff ~/ikki-dost/deploy/ikki-dost/compose.yaml /tmp/ikki-new/deploy/ikki-dost/compose.yaml
```

Kutilgan farq: faqat `CASHIER_KIOSK` / `CASHIER_KIOSK_KEY` qatorlari qo‘shilgan.
Agar serverdagi faylda **boshqa** qo‘lda kiritilgan o‘zgarishlar bo‘lsa (portlar,
tarmoqlar, nginx va h.k.) — ularni yangi faylga ko‘chiring yoki foydalanuvchidan
so‘rang. Ko‘r-ko‘rona ustidan yozmang.

### 4. Kodni almashtirish (`.env` saqlanadi)

```bash
cp ~/ikki-dost/deploy/ikki-dost/.env /tmp/ikki-env-keep
rsync -a --delete \
  --exclude 'deploy/ikki-dost/.env' \
  --exclude 'apps/api/uploads/' \
  --exclude 'apps/bot/data/' \
  --exclude 'node_modules/' \
  /tmp/ikki-new/ ~/ikki-dost/
cmp /tmp/ikki-env-keep ~/ikki-dost/deploy/ikki-dost/.env && echo ".env saqlandi"
```

`rsync` bo‘lmasa: `cp -a /tmp/ikki-new/. ~/ikki-dost/` (keyin `.env` ni
`/tmp/ikki-env-keep` dan qaytaring va `cmp` bilan tekshiring).

### 5. Kassani yoqish

```bash
cd ~/ikki-dost
grep -q '^CASHIER_KIOSK=' deploy/ikki-dost/.env || printf '\nCASHIER_KIOSK=on\n' >> deploy/ikki-dost/.env
grep '^CASHIER_KIOSK' deploy/ikki-dost/.env
```

`CASHIER_KIOSK_KEY` ni hozircha **qo‘shmang**: hozirgi exe/AppImage kalitsiz
yig‘ilgan, kalit qo‘shilsa ular ulana olmaydi (foydalanuvchi keyin GitHub secret
bilan birga qo‘shadi).

### 6. Qayta yig‘ish va ishga tushirish

```bash
cd ~/ikki-dost
docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env \
  --profile bot up -d --build api bot
```

Faqat `api` va `bot` qayta yig‘iladi; `db` ga tegilmaydi.

### 7. Tekshiruv

```bash
docker ps --filter name=ikki-dost --format '{{.Names}}\t{{.Status}}'
docker exec ikki-dost-api node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.text()).then(console.log)"
docker exec ikki-dost-api node -e "fetch('http://127.0.0.1:3000/api/auth/kiosk',{method:'POST'}).then(r=>console.log('kiosk',r.status))"
docker logs --tail 30 ikki-dost-bot
```

Kutilgan natija:
- `ikki-dost-api` — `Up … (healthy)`, health `{"status":"ok"…}`;
- kiosk — `kiosk 201` (birinchi chaqiruvda `kassa` xodimi avtomatik yaratiladi);
- bot logida `✅ Telegramga ulandi: @...`.

### 8. Muammo bo‘lsa — orqaga qaytarish

```bash
cd ~ && rm -rf ikki-dost && tar xzf <oxirgi ikki-dost-src-backup-…tar.gz>
cd ~/ikki-dost && docker compose -f deploy/ikki-dost/compose.yaml --env-file deploy/ikki-dost/.env \
  --profile bot up -d --build api bot
```

Baza o‘zgarmagani uchun odatda uni tiklash shart emas; kerak bo‘lsa
`~/ikki-dost-db-….sql.gz` zaxira bor.

## Yakunda foydalanuvchiga hisobot

1. Har bir qadam natijasi (ayniqsa 3-qadam diff, 7-qadam tekshiruvi).
2. Telegram’da `@ikkidostbot` ga `/start` → «🏠 Zal» chiqishini tekshirishni so‘rang.
3. Kassa ilovasini (MSI yoki AppImage) ochib, «Kassa» ekrani to‘g‘ridan-to‘g‘ri
   ochilishini tekshirishni so‘rang.
4. Eslatma: `deploy` parolini almashtirish (`passwd`) va SSH kalitga o‘tish tavsiya etiladi.

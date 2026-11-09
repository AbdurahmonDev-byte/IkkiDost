# Ikki Do‘st — Telegram Boti (`@ikki-dost/bot`)

Ikki Do‘st choyxonasi xodimlari va mijozlari uchun yagona Telegram boti. iOS, Android, Windows, Mac va Linux'da Telegram orqali ishlaydi.

## Asosiy imkoniyatlar

- **Yagona backend va DB:** markaziy NestJS API (`apps/api`) bilan ishlaydi; botda biznes ma'lumotlari uchun alohida DB yo‘q.
- **Xodimlar uchun RBAC:** `OWNER`, `WAITER`, `CHEF`, `CASHIER` rollariga mos menyu va amallar.
- **Xavfsiz avtorizatsiya:** xodim paroli tekshirilgach chatdan o‘chiriladi; JWT refresh token rotatsiyasi avtomatik.
- **Mijozlar uchun buyurtma:** zal yoki yetkazib berish buyurtmasi, savat, xizmat haqi preview, izoh, tasdiqlash va chek.
- **Ofitsiant chaqirish:** xona deep-linki yoki bot menyusi orqali.
- **Bildirishnomalar:** xodim chatlariga yangi buyurtma, tayyor taom va boshqa holatlar haqida xabar.
- **Audit va qoidalar:** to‘lovlar faqat kassir/egasi tomonidan; qarz bilan xona yopish sabab va audit yozuvi talab qiladi.

## Rollar

| Rol | Imkoniyatlar |
|---|---|
| **OWNER** | Xonalar, yetkazish, oshxona, hisobot, qarz bilan yopish |
| **WAITER** | Xonalar, zal buyurtmalari, taom qo‘shish, yetkazish yaratish |
| **CHEF** | Oshxona navbati, tayyorlashni boshlash va READY belgilash |
| **CASHIER** | Xonalar/yetkazish holatlari va hisob-kitoblarni ko‘rish |

## Buyruqlar

- `/start` — botni boshlash; xona deep-linkini ham qabul qiladi
- `/login` — xodim hisobini ulash
- `/logout` — hisobni uzish
- `/menu` — bosh menyu
- `/rooms` — xonalar
- `/kitchen` — oshxona
- `/delivery` — yetkazishlar
- `/newdel` — yangi yetkazish
- `/dash` yoki `/stats` — egasi uchun hisobot
- `/me` — profil
- `/help` — yordam

## Sozlash

Loyiha ildizidagi `.env` yoki `apps/bot/.env` faylida:

```env
BOT_TOKEN="..."                         # @BotFather tokeni
API_URL="https://api.example.uz/api"    # NestJS API manzili
MINI_APP_URL="https://app.example.uz"   # Telegram Mini App HTTPS manzili
BOT_NOTIFY_INTERVAL_MS=10000
BOT_STORE_PATH="data/sessions.json"

# Mijozlarning mustaqil buyurtmalari uchun alohida backend WAITER hisobi.
# Bu hisobni admin panelda yarating; OWNER hisobidan foydalanmang.
BOT_USERNAME="telegram-bot"
BOT_PASSWORD="..."
```

`BOT_USERNAME` va `BOT_PASSWORD` ikkalasi ham berilsa, mijoz buyurtmalari backenddagi alohida WAITER hisobi orqali yaratiladi. Ular berilmasa, xodimlar funksiyalari ishlaydi, lekin mijozlarning bot orqali buyurtma yuborishi o‘chiq bo‘ladi. Haqiqiy qiymatlarni GitHub'ga commit qilmang.

Bot konfiguratsiyasi workspace ichidagi `.env` va monorepo ildizidagi `.env` fayllarini qo‘llab-quvvatlaydi.

## Ishga tushirish

Loyiha ildizidan:

```bash
npm install
npm run dev:bot
npm run build -w @ikki-dost/bot
npm run typecheck -w @ikki-dost/bot
```

Production'da botni process manager (masalan, systemd yoki PM2) orqali doimiy ishlating. API va Mini App HTTPS orqali tashqariga ochiq bo‘lishi kerak.

# Ikki Do‘st — Telegram Boti (`@ikki-dost/bot`)

Ikki Do‘st choyxonasi xodimlari uchun yagona Telegram boti. Barcha qurilmalarda (iOS, Android, Windows, Mac, Linux) o‘rnatishlarsiz to‘g‘ridan-to‘g‘ri Telegram orqali ishlaydi.

## Asosiy afzalliklari

- **Yagona backend va bitta DB**: Alohida ma'lumotlar bazasisiz, to‘g‘ridan-to‘g‘ri markaziy NestJS API (`apps/api`) bilan ishlaydi.
- **To‘liq RBAC (rolga asoslangan kirish)**: Xodimlar o‘z lavozimlariga (`OWNER`, `WAITER`, `CHEF`, `CASHIER`, `DELIVERY`) mos menyu va imkoniyatlarga ega bo‘ladi.
- **Xavfsiz avtorizatsiya**: Xodimlar egasi biriktirgan Telegram ID orqali parolsiz kiradi; egasi ham `OWNER_TELEGRAM_IDS` ro‘yxati orqali qo‘shimcha parolsiz kiradi. JWT tokenlar rotatsiyasi va muddati tugaganda yangilanishi avtomatik amalga oshadi.
- **Xabarnomalar (Notifications)**: Orqa fondagi poller orqali yangi buyurtmalar, tayyor taomlar, kuryer naqd pullari va holat o‘zgarishlari xodimning Telegramiga darhol yuboriladi.
- **Audit va qoidalar**: To‘lovlar faqat kassa yoki egasi tomonidan boshqariladi; qarzdorlik bilan xona yopish faqat sabab ko‘rsatilganda egasiga ruxsat etiladi (audit jurnalida qayd etiladi).

---

## Rollar bo‘yicha imkoniyatlar

| Rol | Buyruqlar va imkoniyatlar |
|---|---|
| **Egasi (`OWNER`)** | Barcha bo‘limlar: Xonalar, Yetkazish, Oshxona, Hisobot (Dashboard), Qarz bilan yopish override, bildirishnomalar |
| **Ofitsiant (`WAITER`)** | Xonalar ro‘yxati, xonaga yangi buyurtma ochish / taom qo‘shish, tayyor taomni berildi deb belgilash, yangi yetkazish yaratish |
| **Oshpaz (`CHEF`)** | Oshxona ekrani (`/kitchen`), buyurtmalarni tayyorlashni boshlash va tayyor deb belgilash |
| **Kassir (`CASHIER`)** | Xonalar va yetkazishlar holatini, hisob-kitoblarni ko‘rish; kuryer naqd pulini “To‘lov qilindi” bilan tasdiqlash |
| **Kuryer (`DELIVERY`)** | Biriktirilmagan yetkazishlarni qabul qilish, `Yo‘lda` → `Yetkazildi`, mijozdan olingan naqd pulni qayd etish |

---

## Buyruqlar

Mijozlar uyga yetkazish buyurtmasini Mini App orqali beradi. Zaldagi mijozlar
telefondan buyurtma bermaydi; xizmat uchun ofitsiant chaqiradi.

- `/start` — Botni ishga tushirish; staff Telegram ID orqali kiradi, ID biriktirilmagan bo‘lsa egasiga yuboradi; mijozdan yetkazish manzilini so‘raydi (lokatsiya yoki qo‘lda)
- `/logout` — Telegram hisobini tizimdan uzish
- `/menu` — Foydalanuvchi roliga mos bosh menyu
- `/rooms` — Xonalar ro‘yxati va bandlik holati
- `/kitchen` — Oshxona buyurtmalari (Oshpaz va Egasi)
- `/delivery` — Faol yetkazish buyurtmalari ro‘yxati; kuryer naqd pulni qayd etadi, kassir/egasi “To‘lov qilindi” bilan tasdiqlaydi
- `/newdel` — Yangi yetkazish buyurtmasi yaratish (Ofitsiant va Egasi)
- `/dash` yoki `/stats` — Bugungi moliyaviy va operatsion hisobot (Faqat egasi)
- `/me` — Foydalanuvchi ma'lumotlari va roli
- `/help` — Yordam va buyruqlar ro‘yxati

---

## Sozlash va ishga tushirish

### 1. Muhit o‘zgaruvchilari (`.env`)

Loyiha ildizidagi `.env` yoki `apps/bot/.env` faylida:

```env
BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" # @BotFather dan olingan token
API_URL="http://localhost:3000/api"
BOT_NOTIFY_INTERVAL_MS=10000
BOT_STORE_PATH="data/sessions.json"
```

### 2. Ishga tushirish

Loyiha ildizidan:

```bash
# Rivojlanish (dev) rejimida
npm run dev:bot

# Build qilish
npm run build -w @ikki-dost/bot

# Typecheck
npm run typecheck
```

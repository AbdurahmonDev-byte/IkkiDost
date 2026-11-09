# Ikki Do‘st — Telegram Boti (`@ikki-dost/bot`)

Ikki Do‘st choyxonasi xodimlari uchun yagona Telegram boti. Barcha qurilmalarda (iOS, Android, Windows, Mac, Linux) o‘rnatishlarsiz to‘g‘ridan-to‘g‘ri Telegram orqali ishlaydi.

## Asosiy afzalliklari

- **Yagona backend va bitta DB**: Alohida ma'lumotlar bazasisiz, to‘g‘ridan-to‘g‘ri markaziy NestJS API (`apps/api`) bilan ishlaydi.
- **To‘liq RBAC (rolga asoslangan kirish)**: Xodimlar o‘z lavozimlariga (`OWNER`, `WAITER`, `CHEF`, `CASHIER`) mos menyu va imkoniyatlarga ega bo‘ladi.
- **Xavfsiz avtorizatsiya**: Parollar chatda saqlanmaydi (tekshirilgach zudlik bilan o‘chiriladi); JWT tokenlar rotatsiyasi va muddati tugaganda yangilanishi avtomatik amalga oshadi.
- **Xabarnomalar (Notifications)**: Orqa fondagi poller orqali yangi buyurtmalar, tayyor taomlar va holat o‘zgarishlari xodimning Telegramiga darhol yuboriladi.
- **Audit va qoidalar**: To‘lovlar faqat kassa yoki egasi tomonidan boshqariladi; qarzdorlik bilan xona yopish faqat sabab ko‘rsatilganda egasiga ruxsat etiladi (audit jurnalida qayd etiladi).

---

## Rollar bo‘yicha imkoniyatlar

| Rol | Buyruqlar va imkoniyatlar |
|---|---|
| **Egasi (`OWNER`)** | Barcha bo‘limlar: Xonalar, Yetkazish, Oshxona, Hisobot (Dashboard), Qarz bilan yopish override, bildirishnomalar |
| **Ofitsiant (`WAITER`)** | Xonalar ro‘yxati, xonaga yangi buyurtma ochish / taom qo‘shish, tayyor taomni berildi deb belgilash, yangi yetkazish yaratish |
| **Oshpaz (`CHEF`)** | Oshxona ekrani (`/kitchen`), buyurtmalarni tayyorlashni boshlash va tayyor deb belgilash |
| **Kassir (`CASHIER`)** | Xonalar va yetkazishlar holatini, hisob-kitoblarni ko‘rish |

---

## Buyruqlar

- `/start` — Botni ishga tushirish
- `/login` — Tizimdagi login va parol orqali ulanish (`login parol`)
- `/logout` — Telegram hisobini tizimdan uzish
- `/menu` — Foydalanuvchi roliga mos bosh menyu
- `/rooms` — Xonalar ro‘yxati va bandlik holati
- `/kitchen` — Oshxona buyurtmalari (Oshpaz va Egasi)
- `/delivery` — Faol yetkazish buyurtmalari ro‘yxati
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

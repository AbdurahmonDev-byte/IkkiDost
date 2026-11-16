# Ikki Do‘st — Kassir (Windows)

Tauri 2 asosidagi kassir dasturi. Mini App, bot va API bilan **bitta server**
(`https://ikkidost.abitcore.uz/api`) va bitta bazadan ishlaydi — barcha buyurtmalar,
to‘lovlar va hisobotlar umumiy.

## Imkoniyatlar

- **Zallar** — ochiq xona hisoblari; «Yangi buyurtma» bilan zalga buyurtma yaratish.
- **Saboy** — uydan telefon orqali qilingan buyurtmalar; kassir mijoz ismi, telefoni,
  manzili va mahsulotlarini kiritadi. Bugungi va qarzdor saboylar ko‘rinadi.
- **Yetkazish** — to‘lanmagan saboylar, kuryer holati va naqd pul topshirish.
- **Qo‘shish** — mavjud zal yoki saboy buyurtmasiga keyinroq mahsulot qo‘shish.
- To‘lov (naqd/karta), qismli to‘lov, qaytarish, 80 mm chek chop etish.
- Kg/litr mahsulotlarda aniq miqdor (`1.82`, `2.3`), dona mahsulotlarda butun son.

## Kirish

Dastur faqat `CASHIER` va `OWNER` rollari uchun. Login/parol admin panelda
yaratilgan xodim hisobi bilan bir xil.

## Build

Windows uchun GitHub Actions orqali quriladi:

```
.github/workflows/cashier-windows.yml
```

Natija: `ikki-dost-cashier.exe` va MSI installer (`bundle/msi/`).

Mahalliy (Linux) tekshiruv:

```bash
npm run typecheck -w @ikki-dost/cashier-desktop
npm run build -w @ikki-dost/cashier-desktop
```

API manzili build vaqtida beriladi:

```bash
VITE_API_URL=https://ikkidost.abitcore.uz/api npm run build -w @ikki-dost/cashier-desktop
```

## O‘rnatish

1. `Ikki Do'st Kassir_0.1.0_x64_en-US.msi` ni ishga tushiring (yoki `.exe` ni to‘g‘ridan-to‘g‘ri).
2. SmartScreen ogohlantirishi chiqishi mumkin — imzo hali qo‘yilmagan.
3. Windows 10 da WebView2 Runtime kerak (Windows 11 da o‘rnatilgan).

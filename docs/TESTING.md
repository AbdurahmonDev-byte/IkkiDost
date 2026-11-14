# TESTING

## 1. Automated checks

| Command | What it covers |
|---|---|
| `npm run typecheck` | strict TypeScript across all 9 workspaces |
| `cd apps/api && npx vitest run` | backend integration suite against real PostgreSQL |
| `npm run build -w @ikki-dost/api` | NestJS production build |
| `npm run build -w @ikki-dost/bot` | bot TypeScript build |
| `npm run build -w @ikki-dost/mini-app` | `tsc` + Vite production bundle |
| `npm run build -w @ikki-dost/admin-web` | Next.js production build + route prerender |
| `cd legacy/mobile && npx tsc --noEmit` | legacy Expo/React Native typecheck |
| `cd legacy/cashier-desktop && npx tauri build` | legacy desktop binary + OS packages |

### Backend test environment

Vitest uses SWC (`unplugin-swc`) so NestJS decorator metadata works. The suite
boots against the embedded PostgreSQL instance (port 5433) and resets the
`ikki_dost_test` database with `prisma migrate reset` before running.

```bash
npm run db:start            # if the embedded server is not running
cd apps/api
npx vitest run              # 51 tests
npx vitest                  # watch mode
```

Test credentials (seeded):

| Username | Password | Role |
|---|---|---|
| `owner` | `owner12345` | OWNER |
| `ofitsiant` | `password123` | WAITER |
| `oshpaz` | `password123` | CHEF |
| `kassir` | `password123` | CASHIER |
| `kuryer` | `password123` | DELIVERY |
| `bot` | `SEED_BOT_PASSWORD` (falls back to `SEED_PASSWORD`, dev `password123`) | WAITER, self-service actor — do not log in with it |

Telegram staff authentication and customer-registration integration tests
generate signed, time-valid `initData` with a test bot token. Live Telegram
delivery and Mini App behavior still require manual verification (see §4).

## 2. Current results (2026-11-13)

- Backend integration suite: **51/51 passing**, 1 file, ~4.5 s of test time.
- Telegram tests cover owner-assigned staff IDs, employee password-login
  rejection, passwordless owner login via the Telegram allowlist, mandatory
  phone verification, official customer names, and the delivery-only order rule.
- Location/cash tests cover the bot-saved delivery address and Mini App profile
  prefill, address persistence from `POST /public/orders`, the courier cash
  prompt on `DELIVERED`, the cashier handover recording a CASH payment, the
  order auto-completing after handover, the courier's handover rejection (`403`)
  and repeated-handover rejection (`400`).
- `npm run typecheck`: **passing** for API, bot, mini-app, admin-web and all
  shared packages.
- API / bot / mini-app / admin-web production builds: **passing**.
- Mini App production bundle: JS 256.97 kB (71.87 kB gzip), CSS 34.50 kB
  (6.60 kB gzip).
- Mini App served by the API: `/` → 200 HTML, `/api/health` → 200,
  unknown `/api/*` → 404, SPA fallback → 200.
- Production deploy on 2026-11-14: API/bot images rebuilt from `d8a2c16`,
  API healthy, bot connected to `@ikkidostbot`; owner-allowlist login → `201`
  with no password, unknown Telegram ID → `401 TELEGRAM_NOT_LINKED`.
- Local DB migrations `20261112120000_telegram_auth_delivery_customers`,
  `20261112180000_enforce_telegram_staff_login` and
  `20261113005418_delivery_cash_handover` applied; seed includes the `kuryer`
  DELIVERY account.
- Telegram-auth, customer-registration, delivery-claim, location, cash-handover
  and receipt flows: implemented and build-verified; final live verification
  happens after the next production rollout (the server currently runs the
  previous release).
- admin-web production build: **passing** (20 routes).
- Tauri Linux: **binary + `.deb` + `.rpm` produced** (legacy app). AppImage
  packaging failed while downloading `linuxdeploy-plugin-appimage`
  (environment network restriction, not an app defect).
- Android APK/AAB: **not built** — no Android SDK in this environment.
- Windows `.exe`/`.msi`: **not built** — must be produced on Windows (`npx tauri build`).

## 3. What the backend suite covers

Scenarios 1–18 from the specification:

1. Dine-in order for 5 people → 20 000 UZS service fee,
   snapshotted and visible to the kitchen.
2. Kitchen receives the new order.
3. Delivery order for 2 people → 8 000 UZS fee.
4. Owner sees all delivery orders; delivery transitions are enforced; order
   completes after delivery + full payment.
5. Disabling the delivery fee affects only future orders.
6. Dine-in fee still applies after the delivery toggle.
7. Historical orders keep their original fee snapshot.
8. Product price change does not rewrite history.
9. New orders use the new price; price change is audited.
10. Chef marks one item ready; order becomes `PARTIALLY_READY`.
11. Waiter receives a notification for the ready item.
12. Waiter marks it served; order history records the full lifecycle.
13. Partial payment 100 000 against a 150 000 bill.
14. Remaining 50 000 clears the balance.
15. Idempotency key prevents double charging.
16. Overpayment beyond the outstanding balance is rejected.
17. Cashier closes a settled room; closing with debt is rejected; owner
    override requires a reason and is written to the audit log.
18. Backend authorization: waiter cannot read owner reports, manage employees
    or settings; chef cannot touch payments/orders/products; cashier cannot
    manage the catalog/rooms/employees; missing/invalid tokens are rejected.

Additional coverage: category/product creation, archiving, archived products
cannot be ordered, image upload validation, dashboard and range reports,
expenses/profit, audit entries, saved delivery addresses and courier →
cashier cash handover.

## 4. Manual QA checklist

### Admin panel (OWNER)

- Login as `owner`; every nav section loads (dashboard, orders, rooms,
  deliveries, products, categories, employees, payments, expenses, reports,
  settings, audit, notifications…).
- Create a room, a category, a product; upload/replace/remove an image.
- Change the service fee; verify existing orders do not change.
- CSV export downloads a file; date-range report renders.
- Logout clears the session.

### Telegram Mini App (customer + staff)

- Open `https://<domain>/` in Telegram (bot webApp button) and in a normal mobile
  browser; layout adapts and the menu loads from `/api/public/menu`.
- Add items, set a KG quantity, add a per-item note, set people count → fee
  preview equals `people × 4 000`.
- As an unregistered user, ordering is blocked with the registration prompt;
  on-site guests use the room picker → “Choy keltiring” instead of ordering.
- Delivery checkout prefills the saved address; edit it, then submit → tracker
  shows status and the receipt matches the kitchen ticket. Reopen the cart:
  the submitted address is prefilled again.
- Submit a delivery order with an empty/short address → validation blocks it.
- “Choy keltiring” creates a waiter notification; repeat taps are throttled.
- Owner assigns staff Telegram IDs in the employee manager / Mini App owner tab.
  Staff `/start` logs in according to the assigned role; employee passwords and
  self-linking are rejected. OWNER (via `OWNER_TELEGRAM_IDS`) also logs in
  without any extra password.
- Open the Mini App as OWNER: the normal “Menyu” (customer) screen appears
  first; pressing the “Egasi” tab opens the owner panel without a password
  prompt.
- Owner changes an employee's role (e.g. WAITER → CASHIER) and toggles
  activate/deactivate in the owner tab; the change is visible after the access
  token refreshes (≤15 min) or on next login.
- Kill the Mini App session and reopen: no stale active order is shown after it
  is completed/cancelled.

### Telegram Mini App (courier → cashier)

- Couriers see unassigned `CONFIRMED`/`PREPARING`/`READY` deliveries, claim one,
  and can only advance `OUT_FOR_DELIVERY` → `DELIVERED`.
- On “Yetkazildi”, the courier records the cash collected (default = outstanding,
  capped at it); a `0` amount is treated as card/no cash.
- The cashier/owner opens the “Kassa” tab, sees the pending handover with the
  amount and courier, and confirms “To‘lov qilindi”.
- The order shows `paidAmount = totalAmount`, `outstandingAmount = 0`, the
  handover timestamp, and auto-completes. A second confirmation is rejected.
- Without cash recorded, the courier cannot hand over; without a handover, the
  order stays unpaid.

### Telegram bot (staff)

- `/start` auto-logs a staff member whose Telegram ID is assigned by the owner.
- An unregistered customer is offered the Telegram profile name and surname or
  can replace them, then shares their own contact to confirm their phone.
- After customer registration (and on every subsequent `/start`) the bot asks
  for the delivery location; send a Telegram location, type an address, or skip.
  The saved address appears in “Profilim” and prefills the Mini App cart.
- `/rooms` → open session → add order → mark served; `/kitchen` → PREPARING →
  READY; `/delivery` → advance status; `/newdel` → name/phone/address chain with
  a location-or-text address prompt.
- Courier `/delivery` → open an `OUT_FOR_DELIVERY` order → “Yetkazildi — naqdni
  qayd etish” → choose the outstanding cash, another amount, or “naqdsiz”.
- Cashier/owner `/delivery` shows pending cash and “Pul topshirildi” →
  “Ha, to‘lov qilindi”; the courier receives a confirmation notification.
- `/dash` is OWNER-only; other roles get a clear denial.
- `/logout` clears the chat session; `/start` checks the sender's ID again.
- A background notification (new order / ready item / waiter call) arrives in
  the staff chat within the poll interval.

### Legacy chef app (CHEF, iPhone Safari)

- Login, kitchen queue shows new orders in realtime.
- Mark an item PREPARING then READY; waiter sees `item:ready` notification.
- Add to Home Screen; enable notifications; web-push toggle works when the
  browser is backgrounded (VAPID configured).
- Safe-area layout is correct on a notched iPhone; buttons are large enough.

### Legacy mobile app (OWNER/WAITER)

- Login as `ofitsiant`; CHEF/CASHIER login is rejected with an explanatory
  message.
- Rooms list shows occupancy; pull-to-refresh works.
- Open an empty room → choose people → add items (KG quantities step 0.25) →
  order created; fee preview matches the API.
- Add items to an existing session; totals update.
- Mark a READY item as served.
- Owner can close a settled session; waiter sees the “cashier closes” note.
- Create a delivery order; advance its status; cancel with confirmation.
- Notifications screen marks read / mark all.
- Kill and reopen the app: session is restored from SecureStore.
- Toggle airplane mode: errors are shown without crashing; queries recover.

### Legacy cashier desktop (CASHIER/OWNER)

- Bills pane lists open rooms/orders; selecting one shows items and balance.
- Partial payment then remaining payment; methods and notes saved.
- Duplicate click does not double-charge (idempotency key reused per attempt).
- Reverse a payment with a reason; balance recalculates.
- Close a settled session; owner override with debt requires a reason.
- Print preview renders an 80 mm receipt with the correct order number, items,
  fee and total.
- Realtime updates arrive when a waiter adds items in another client.

## 5. Test data / reset

- Seeding is idempotent: `npm run db:seed`.
- To wipe the dev database:
  ```bash
  cd apps/api
  npx prisma migrate reset
  node --experimental-strip-types scripts/seed.ts
  ```
- Uploaded test images live under `apps/api/uploads` (gitignored).

## 6. Known gaps / environment limits

- No Android SDK → APK/AAB not built; the JS bundle is validated by export.
- No Windows toolchain → cashier `.exe`/`.msi` not built on this Linux host.
- AppImage packaging requires downloading linuxdeploy plugins; `.deb`/`.rpm`
  and the raw binary are available.
- No automated UI/E2E browser suite (Playwright/Cypress) yet; frontends were
  verified with production builds and manual smoke checks against the live API.
- Load/performance testing has not been run; the target deployment is a single
  restaurant node.

# TESTING

## 1. Automated checks

| Command | What it covers |
|---|---|
| `npm run typecheck` | strict TypeScript across all 9 workspaces |
| `cd apps/api && npx vitest run` | backend integration suite against real PostgreSQL |
| `npm run build -w @ikki-dost/api` | NestJS production build |
| `npm run build -w @ikki-dost/admin-web` | Next.js production build + route prerender |
| `npm run build -w @ikki-dost/chef-web` | Next.js production build |
| `npm run build -w @ikki-dost/cashier-desktop` | `tsc` + Vite production bundle |
| `cd apps/mobile && npx tsc --noEmit` | Expo/React Native typecheck |
| `cd apps/mobile && npx expo export --platform android --no-bytecode` | Metro bundle + asset graph |
| `cd apps/cashier-desktop && npx tauri build` | desktop binary + OS packages |

### Backend test environment

Vitest uses SWC (`unplugin-swc`) so NestJS decorator metadata works. The suite
boots against the embedded PostgreSQL instance (port 5433) and resets the
`ikki_dost_test` database with `prisma migrate reset` before running.

```bash
npm run db:start            # if the embedded server is not running
cd apps/api
npx vitest run              # 45 tests
npx vitest                  # watch mode
```

Test credentials (seeded):

| Username | Password | Role |
|---|---|---|
| `owner` | `owner12345` | OWNER |
| `ofitsiant` | `password123` | WAITER |
| `oshpaz` | `password123` | CHEF |
| `kassir` | `password123` | CASHIER |

## 2. Current results (2026-11-09)

- Backend integration suite: **45/45 passing**, 1 file, ~2.3 s of test time.
- `npm run typecheck`: **passing** for API, admin-web, chef-web, cashier,
  mobile, and all shared packages.
- admin-web production build: **passing** (20 routes).
- chef-web production build: **passing**.
- cashier-desktop `tsc` + Vite build: **passing**.
- mobile TypeScript: **passing**; Metro Android export: **passing**
  (926 modules, 1.57 MB bundle, 10 assets).
- Tauri Linux: **binary + `.deb` + `.rpm` produced**. AppImage packaging failed
  while downloading `linuxdeploy-plugin-appimage` (environment network
  restriction, not an app defect).
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
expenses/profit, audit entries.

## 4. Manual QA checklist

### Admin panel (OWNER)

- Login as `owner`; every nav section loads (dashboard, orders, rooms,
  deliveries, products, categories, employees, payments, expenses, reports,
  settings, audit, notifications…).
- Create a room, a category, a product; upload/replace/remove an image.
- Change the service fee; verify existing orders do not change.
- CSV export downloads a file; date-range report renders.
- Logout clears the session.

### Chef app (CHEF, iPhone Safari)

- Login, kitchen queue shows new orders in realtime.
- Mark an item PREPARING then READY; waiter sees `item:ready` notification.
- Add to Home Screen; enable notifications; web-push toggle works when the
  browser is backgrounded (VAPID configured).
- Safe-area layout is correct on a notched iPhone; buttons are large enough.

### Mobile app (OWNER/WAITER)

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

### Cashier desktop (CASHIER/OWNER)

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

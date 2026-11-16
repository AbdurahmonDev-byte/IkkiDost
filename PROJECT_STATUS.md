# PROJECT STATUS

Last updated: 2026-11-15 — Dark-only Mini App with cashier revenue/expense/profit
charts, on top of cashier admin access, all-order visibility, room and
catalog management, product cost snapshots, net-profit KPIs, printable cashier
receipts, the dark customer-menu design and locally bundled product photos. Delivery-address capture (bot location prompt, saved
customer address, Mini App prefill), courier cash collection with cashier
“To‘lov qilindi” handover, and owner-managed employee roles/activation are
implemented on top of Telegram-ID staff authentication, the DELIVERY role,
mandatory customer registration, the remote-ordering workflow, owner
menu/photo management, the redesigned customer Mini App and printable receipts.
Environment-limited artifacts (Android APK, Windows EXE, AppImage) remain
documented only.

## Legend
- ✅ done · 🟡 in progress / partial · ⬜ not started

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1. Repo inspection | Environment & tooling audit | ✅ |
| 2. Architecture & docs | Monorepo skeleton, docs, decision log | ✅ |
| 3. Backend core | NestJS, Prisma schema, migrations, auth, RBAC, seed | ✅ |
| 4. Business workflows | Products, images, rooms/sessions, orders, service fee, delivery, payments | ✅ |
| 5. Kitchen app + realtime | chef-web (now `legacy/`), Socket.IO events, push fallback | ✅ |
| 6. Android app | Expo app: waiter + owner interfaces (now `legacy/`) | ✅ code + bundle; ⬜ APK (no SDK) |
| 7. Cashier desktop | Tauri 2 + React billing UI (now `legacy/`) | ✅ UI + Linux packages; ⬜ Windows EXE (needs Windows) |
| 8. Admin panel | All 15 sections + reports | ✅ |
| 9. Tests & integration | Unit/integration/E2E critical flows | ✅ backend 51/51; manual UI smoke |
| 10. Deliverables | Deployment docs, build instructions | ✅ (limitations documented) |
| 11. Telegram bot | Omni-device staff bot (rooms, orders, kitchen, delivery, stats, alerts) | ✅ code; live run needs `BOT_TOKEN` |
| 12. Customer Mini App | Telegram Mini App self-service (menu, room/delivery orders, notes, receipts, call waiter) + staff screens | ✅ |
| 13. Telegram-ID staff auth | Staff login by verified Telegram identity, owner-assigned IDs, passwordless owner allowlist, bot auto-login | ✅ |
| 14. Delivery role & remote orders | Dedicated DELIVERY role, customer → kitchen → courier workflow, claimable deliveries, delivery-only public orders | ✅ |
| 15. Registration, receipts & UI | Mandatory name/phone registration via Telegram contact, printable receipts, redesigned Mini App, owner menu/photo management | ✅ |
| 16. Location, cash handover & roles | Telegram location address capture + saved address, courier cash collection, cashier handover confirmation, owner role/activation management, passwordless owner login with customer-first screen | ✅ |
| 17. Dark mode everywhere | Telegram-synced light/dark theme with manual toggle; all staff panels, modals, owner/cashier workspaces themed; contrast-audited | ✅ |

Docs: `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`,
`docs/DEPLOYMENT.md`, `docs/TESTING.md`, plus `DECISIONS.md`.

## Verification snapshot (2026-11-15)

- Mini App dark mode contrast-audited with headless Chrome: cashier (all six
  views), waiter, kitchen, delivery, owner (all sections) and every modal pass
  the 3:1 minimum for body text in both themes; theme toggle persistence and
  Telegram `themeChanged` sync verified end-to-end.
- All workspace TypeScript checks and production builds pass.

## Earlier verification snapshot (2026-11-14)

- `npm run test:api` — **51/51 tests pass**, including cashier room/product
  management, debt-close reason auditing, and cost-aware profit reporting.
- All workspace TypeScript checks pass; API, admin-web and Mini App production
  builds pass after cashier, cost, dashboard and receipt changes.

## Earlier verification snapshot (2026-11-13)

- `npm run typecheck` — passes for all 9 workspaces.
- Backend: `cd apps/api && npx vitest run` — **51/51 tests pass**, including
  owner-assigned Telegram IDs, employee password-login rejection, passwordless
  owner login via the Telegram allowlist, verified customer registration and
  delivery-only public ordering, saved delivery location, and courier cash →
  cashier handover.
- Builds: `@ikki-dost/api`, `@ikki-dost/bot`, `@ikki-dost/mini-app` and
  `@ikki-dost/admin-web` all pass.
- Mini App production bundle: JS 256.97 kB (71.87 kB gzip), CSS 34.50 kB
  (6.60 kB gzip).
- API serves the built Mini App at `/` (HTML 200, `/api/health` 200,
  unknown `/api/*` → 404, SPA fallback → 200).
- Live checks against the production host: bot connected to `@ikkidostbot`,
  Mini App at `https://ikkidost.abitcore.uz`, smoke delivery order created and
  cancelled, owner login verified. The 2026-11-13 change set (location, cash
  handover, role management) and the 2026-11-14 passwordless-owner release
  (commit `d8a2c16`) are deployed; `/api/health` is healthy and the owner
  allowlist login returned `201` without any password, while an unknown
  Telegram ID returned `TELEGRAM_NOT_LINKED`.
- DB migrations `20261112120000_telegram_auth_delivery_customers`,
  `20261112180000_enforce_telegram_staff_login` and
  `20261113005418_delivery_cash_handover` are applied in production and seeded
  locally; the API container runs `prisma migrate deploy` on every start.
- Legacy admin-web/chef-web/mobile/cashier-desktop build results from
  2026-11-09 are preserved under `legacy/`.

## Implemented

### Backend (`apps/api`)
- Embedded PostgreSQL bootstrap for dev/tests (`npm run db:start`), Prisma schema
  plus 6 migrations.
- Seed: owner/ofitsiant/oshpaz/kassir/kuryer + `bot` self-service actor, 3 rooms,
  4 categories, all 14 specified products with exact names/prices/units,
  Naqd/Karta methods, service fee 4 000 UZS/person enabled for both order
  types.
- Auth: argon2, JWT access + rotating refresh tokens with family reuse detection,
  login throttling.
- Staff authenticate only through owner-assigned Telegram IDs; the API resolves
  the employee role from the ID and rejects employee username/password logins.
  OWNER is resolved from `OWNER_TELEGRAM_IDS` and also logs in passwordlessly.
  The rollout migration revokes existing non-owner refresh sessions.
  Bot-only routes are protected by the shared `BOT_TOKEN` secret header.
- RBAC enforced server-side on every route
  (OWNER/WAITER/CHEF/CASHIER/DELIVERY).
- Customers register with first/last name and verify their phone by sharing a
  Telegram contact; verified customers only may place remote (delivery) orders.
  `Customer.deliveryAddress` stores the latest location/manual address and is
  prefilled on the next order; `POST /public/orders` refreshes it.
- Delivery cash reconciliation: the courier records collected cash on
  `DELIVERED` (`Delivery.cashCollectedAmount`/`cashCollectedAt`), and
  CASHIER/OWNER confirm receipt with `POST /deliveries/:id/handover`
  (“To‘lov qilindi”), which records a CASH payment, sets `cashHandedOverAt`,
  audits `DELIVERY_CASH_HANDED_OVER` and notifies the courier.
- Owner-managed employee lifecycle: `PATCH /employees/:id` changes role,
  activation, name/phone or Telegram ID; the last active OWNER cannot be
  deactivated.
- Rooms with a single OPEN session enforced by a row lock; multi-order sessions.
- Orders: dine-in and delivery, item-level workflow, status history, cancellation,
  historical price/fee/cost snapshots.
- Delivery workflow with enforced transitions and optional courier assignment;
  DELIVERY staff see their own deliveries plus claimable unassigned ones and may
  only set `OUT_FOR_DELIVERY` / `DELIVERED` (kitchen readiness syncs to READY).
- Payments: full/partial, order- or session-level, idempotency, reversal with
  audit, overpayment rejection, transactional cached totals.
- Room close blocked with debt; owner override requires reason + audit entry.
- Product images: sharp → WebP + thumbnail, MIME/size validation, replace/remove.
- Expenses, reports/dashboard, audit log, notifications, Web Push (VAPID).
- Socket.IO `/rt` with JWT auth, role/user rooms, central `RealtimeService`.

### Admin panel (`apps/admin-web`)
All 15 admin sections for OWNER and CASHIER, auth shell, shared UI kit, toasts,
charts, CSV export, product cost/margin entry, net-profit KPIs and printable
payment receipts.
Production build passes; every route returned 200 in the live preview.

### Legacy chef kitchen app (`legacy/chef-web`)
iPhone-Safari-first kitchen screen, realtime queue, item status updates, Web Push
fallback, PWA manifest/service worker/icon. Production build passes and was
verified end-to-end against the live API.

### Legacy cashier desktop (`legacy/cashier-desktop`)
Two-pane bills, partial/full payments, payment methods, idempotency keys,
reversals, session close with owner override, delivery transitions, 80 mm
printable receipt. Vite build passes. Tauri 2 Linux build produced:
- `src-tauri/target/release/ikki-dost-cashier` (≈11 MB)
- `bundle/deb/Ikki Do'st Kassir_0.1.0_amd64.deb` (≈2.9 MB)
- `bundle/rpm/Ikki Do'st Kassir-0.1.0-1.x86_64.rpm` (≈2.95 MB)

### Legacy mobile app (`legacy/mobile`)
Expo SDK 51 + Expo Router app for OWNER and WAITER:
- SecureStore-persisted auth, automatic access-token refresh and retry.
- Rooms list with live occupancy/balances; room session screen with multi-order
  display, item serving, cancellation with reason, owner close-with-debt override.
- Menu picker with categories/search, decimal KG quantities, live service-fee
  preview based on people count.
- Delivery list/new/detail with workflow progression and phone/address actions.
- Notifications screen, owner dashboard (revenue, expenses, debt, fee, popular
  products, 7-day chart, recent activity).
- Socket.IO realtime invalidation using the canonical `RtEvent` names.
- Android JS bundle export validated; APK not built (no Android SDK).

### Shared packages
`shared-types` (DTOs, enums, realtime events), `validation` (Zod request
schemas), `utils` (integer-UZS money math, service fee, formatting),
`api-client` (typed fetch client with auth + errors), `design-system` (tokens).

### Telegram bot (`apps/bot`)
Multi-role staff bot built with grammY on Node.js/TypeScript:
- Staff login by verified Telegram identity for every role, including the
  owner allowlist; no password is requested. Non-owner password login and
  self-linking are rejected.
- Role-adapted home menu and commands (`/rooms`, `/kitchen`, `/delivery`, `/newdel`, `/dash`, `/me`, `/help`).
- Waiter / Owner room sessions: browse rooms, create dine-in orders with people count and menu categories, mark items as served, close sessions with reason when debt override is needed.
- Kitchen queue for Chefs & Owners: view incoming orders, start preparation (`PREPARING`), mark items `READY`; couriers cannot advance kitchen states.
- Delivery workflow: view active deliveries, claim unassigned ones, advance
  `OUT_FOR_DELIVERY` → `DELIVERED`, and create new deliveries.
- Customer registration and phone verification by Telegram contact sharing;
  `/start` and the customer menu immediately prompt for a delivery location
  (Telegram location, manual text or skip) and save it to the profile.
- Courier cash prompt on `DELIVERED` (defaults to the outstanding amount) and a
  cashier “To‘lov qilindi” handover confirmation, with pending-cash badges in
  the delivery list.
- The bot no longer runs customer order wizards — customers order through the
  Mini App.
- Owner dashboard (`/dash`): real-time summary of today's revenue, collected payments, unpaid debt, expenses, popular dishes.
- Background notification poller with emoji alerts sent directly to staff chat.
- Command menu registered with Telegram; `/newdel` deep link for creating deliveries.

> The legacy admin-web, chef-web, mobile (Expo) and cashier-desktop apps were
> moved to `legacy/`; their original status text is kept there for history.
> The active client set is API + bot + Mini App (+ `admin-web` still present).

### Customer Mini App (`apps/mini-app`)
Telegram Mini App served by the API at `/` (same origin as `/api`), Vite + React
+ Tailwind + lucide-react:
- Modern hero/search/category menu, cart, decimal KG quantities, and live
  service-fee preview (default 4 000 UZS/person).
- Mandatory first-run registration: first/last name plus phone verification
  through Telegram contact sharing; bot `/start` offers Telegram profile names
  for confirmation/editing, and the official name replaces the display name.
- Remote ordering is delivery-only and requires a verified customer; on-site
  guests can call a waiter from the room picker instead of ordering from a
  phone.
- Per-item kitchen notes, delivery details validation, order tracker polling
  every 5 s, and a printable electronic receipt (items, service fee, total).
- Cart prefills the saved `Customer.deliveryAddress` (or the last local address)
  and still allows manual edits or a mapped geolocation link.
- Staff mode: Telegram auto-login for OWNER/WAITER/CHEF/CASHIER/DELIVERY with
  role tabs (rooms, kitchen, delivery, cashier, owner) and owner-assigned IDs.
  There is no extra owner password; OWNER opens on the customer screen and
  enters the owner panel via the “Ega” tab.
- Owner screen: revenue/debt stats, add products, upload/replace dish photos,
  add categories, manage the product list, assign Telegram IDs, change an
  employee's role, activate/deactivate staff, and create
  WAITER/CHEF/CASHIER/DELIVERY employees without needing the separate admin-web.
- Delivery checkout requests device geolocation with user permission and stores
  the resulting map URL with the manually editable delivery address.
- DELIVERY screen: claim unassigned deliveries, advance hand-off status, and
  record the cash collected at the door.
- Cashier screen (OWNER/CASHIER): pending courier handovers with totals,
  customer/courier details and a “To‘lov qilindi” confirmation.
- Public endpoints throttled: orders 20/min, call-waiter 6/min, registration
  10/min.
- Customer receipts and tracking are scoped to the Telegram identity.

### Deployment
- `Dockerfile.deploy` builds api + bot + mini-app; `deploy/ikki-dost/compose.yaml`
  runs api + PostgreSQL, optional `bot` profile.
- nginx terminates TLS for `ikkidost.abitcore.uz` and proxies everything to the
  API, which also serves the Mini App and `/uploads`.


## Known limitations of this environment

- **No Android SDK** → no APK/AAB. The JavaScript bundle is validated by
  `expo export`; build the APK with EAS or Android Studio (see DEPLOYMENT §12).
- **Windows** is required for the cashier `.exe`/`.msi`; Linux builds cannot
  cross-compile Tauri. Linux binary + `.deb` + `.rpm` exist.
- **AppImage** bundling failed while downloading `linuxdeploy-plugin-appimage`
  (network restriction). Retry on an unrestricted machine.
- **No automated browser UI suite** (Playwright/Cypress); frontends were checked
  by production builds and manual smoke tests against the live API.
- **No load testing**; single-node deployment is the target (ADR-008).
- **Telegram runtime config** — production needs `BOT_TOKEN`, `BOT_USERNAME`
  and `TELEGRAM_AUTH_MAX_AGE_SECONDS`; Telegram Mini App auth cannot be
  exercised outside Telegram (the browser shows the menu only).
- **Real SMS OTP is not used** — phone confirmation relies on Telegram contact
  sharing, which requires the Mini App/bot to run inside Telegram.
- Docker deploy files are provided and lint-reviewed, but no Docker daemon is
  available here, so the image was not built in this environment.

## Next steps for the owner

1. Change the seeded owner password and create real staff accounts, assigning
   each employee's Telegram ID in the owner panel.
2. Upload real product images and confirm prices/units with the 14 products.
3. Configure rooms and the service fee policy.
4. Deploy per `docs/DEPLOYMENT.md`; enable HTTPS, backups, VAPID push.
5. Set `BOT_TOKEN`, `BOT_USERNAME` and `TELEGRAM_AUTH_MAX_AGE_SECONDS` in the
   deploy `.env`, restart API + bot, and roll out the new migration.
6. Register the Mini App URL via `/setmenubutton` on `@BotFather`.
7. Build/sign the Android APK and the Windows cashier installer on suitable
   machines, then run the manual QA checklist in `docs/TESTING.md`.

## Staff-only ordering (ADR-030)
- Bot, Mini App and API no longer accept customer orders or waiter calls.
- Mini App order flow is staff-only for OWNER, WAITER and CASHIER, with exact kg/liter quantities.
- API e2e: 52/52 passing. Typecheck and Mini App build pass.
- Remaining: Windows cashier `.exe` (Tauri app in `legacy/cashier-desktop` needs a rebuild and a Windows build machine).

## Windows cashier build (2026-11-16)
- `legacy/cashier-desktop` (Tauri 2) builds on GitHub Actions `windows-latest` via `.github/workflows/cashier-windows.yml`.
- Produces `ikki-dost-cashier.exe` (8.6 MB) and `Ikki Do'st Kassir_0.1.0_x64_en-US.msi` (2.9 MB); artifact `ikki-dost-kassir-windows` on run 43877447520.
- NSIS bundling fails (NSIS 3.13 issue), so bundle target is `msi`.
- Production CORS allows `http://tauri.localhost`, `https://tauri.localhost`, `tauri://localhost`.
- Not yet runtime-tested on Windows; installer is unsigned (SmartScreen warning).

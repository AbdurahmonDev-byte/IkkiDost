# PROJECT STATUS

Last updated: 2026-11-11 — Telegram bot + customer Mini App complete and served by
the API; Docker deploy files added. Environment-limited artifacts (Android APK,
Windows EXE, AppImage) remain documented only.

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
| 9. Tests & integration | Unit/integration/E2E critical flows | ✅ backend 45/45; manual UI smoke |
| 10. Deliverables | Deployment docs, build instructions | ✅ (limitations documented) |
| 11. Telegram bot | Omni-device staff bot (rooms, orders, kitchen, delivery, stats, alerts) | ✅ code; live run needs `BOT_TOKEN` |
| 12. Customer Mini App | Telegram Mini App self-service (menu, room/delivery orders, notes, receipts, call waiter) + staff screens | ✅ |

Docs: `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`,
`docs/DEPLOYMENT.md`, `docs/TESTING.md`, plus `DECISIONS.md`.

## Verification snapshot (2026-11-11)

- `npm run typecheck` — passes for all 9 workspaces.
- Backend: `cd apps/api && npx vitest run` — **45/45 tests pass**.
- Builds: `@ikki-dost/api`, `@ikki-dost/bot`, `@ikki-dost/mini-app` all pass.
- API serves the built Mini App at `/` (HTML 200, `/api/health` 200,
  unknown `/api/*` → 404, SPA fallback → 200).
- Live public-API smoke test: self-service dine-in order created (2 people,
  20 000 UZS items + 8 000 UZS fee), `createdByName: 'Mijoz (Self-service)'`;
  `POST /api/public/call-waiter` returned success.
- Legacy admin-web/chef-web/mobile/cashier-desktop build results from
  2026-11-09 are preserved under `legacy/`.

## Implemented

### Backend (`apps/api`)
- Embedded PostgreSQL bootstrap for dev/tests (`npm run db:start`), Prisma schema
  plus 2 migrations.
- Seed: owner/ofitsiant/oshpaz/kassir + `bot` self-service actor, 3 rooms, 4
  categories, all 14 specified products with exact names/prices/units,
  Naqd/Karta methods, service fee 4 000 UZS/person enabled for both order
  types.
- Auth: argon2, JWT access + rotating refresh tokens with family reuse detection,
  login throttling.
- RBAC enforced server-side on every route (OWNER/WAITER/CHEF/CASHIER).
- Rooms with a single OPEN session enforced by a row lock; multi-order sessions.
- Orders: dine-in and delivery, item-level workflow, status history, cancellation,
  historical price/fee snapshots.
- Delivery workflow with enforced transitions and courier assignment.
- Payments: full/partial, order- or session-level, idempotency, reversal with
  audit, overpayment rejection, transactional cached totals.
- Room close blocked with debt; owner override requires reason + audit entry.
- Product images: sharp → WebP + thumbnail, MIME/size validation, replace/remove.
- Expenses, reports/dashboard, audit log, notifications, Web Push (VAPID).
- Socket.IO `/rt` with JWT auth, role/user rooms, central `RealtimeService`.

### Admin panel (`apps/admin-web`)
All 15 owner sections, auth shell, shared UI kit, toasts, charts, CSV export.
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
- Staff login (`/login`) with ephemeral password message auto-deletion, JWT token rotation & refresh.
- Role-adapted home menu and commands (`/rooms`, `/kitchen`, `/delivery`, `/newdel`, `/dash`, `/me`, `/help`).
- Waiter / Owner room sessions: browse rooms, create dine-in orders with people count and menu categories, mark items as served, close sessions with reason when debt override is needed.
- Kitchen queue for Chefs & Owners: view incoming orders, start preparation (`PREPARING`), mark items `READY`.
- Delivery workflow: view active orders, advance delivery stages (`CONFIRMED` -> `PREPARING` -> `READY` -> `OUT_FOR_DELIVERY` -> `DELIVERED`), create new deliveries with customer name, phone, address, and food cart.
- Owner dashboard (`/dash`): real-time summary of today's revenue, collected payments, unpaid debt, expenses, popular dishes.
- Background notification poller with emoji alerts sent directly to staff chat.
- Command menu registered with Telegram; `/newdel` deep link for creating deliveries.

> The legacy admin-web, chef-web, mobile (Expo) and cashier-desktop apps were
> moved to `legacy/`; their original status text is kept there for history.
> The active client set is API + bot + Mini App (+ `admin-web` still present).

### Customer Mini App (`apps/mini-app`)
Telegram Mini App served by the API at `/` (same origin as `/api`), Vite + React
+ Tailwind + lucide-react:
- Public menu with categories/search, cart, decimal KG quantities, room or
  home-delivery selection.
- Per-item kitchen notes entered by the customer (reaches the kitchen order).
- People count with live service-fee preview (4 000 UZS/person default).
- Delivery details (name, phone, address) validated before submission.
- Order tracker polling every 5 s, expandable electronic receipt (items,
  service fee, total) and “Choy keltiring / Hisobni bering” waiter call.
- Staff mode: login for OWNER/WAITER/CHEF/CASHIER with role screens (kitchen
  queue, waiter rooms, owner dashboard).
- Self-service orders are created through `POST /api/public/orders` with a
  dedicated seeded `bot` actor (`Mijoz (Self-service)`), so audit is honest.
- Public endpoints throttled: orders 20/min, call-waiter 6/min.

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
- **Bot live run needs a real `BOT_TOKEN`** from @BotFather. Source, build and
  command registration are complete, but polling cannot be exercised without a
  token and a public `MINI_APP_URL`.
- Docker deploy files are provided and lint-reviewed, but no Docker daemon is
  available here, so the image was not built in this environment.

## Next steps for the owner

1. Change the seeded owner password and create real staff accounts.
2. Upload real product images and confirm prices/units with the 14 products.
3. Configure rooms and the service fee policy.
4. Deploy per `docs/DEPLOYMENT.md`; enable HTTPS, backups, VAPID push.
5. Create the bot with @BotFather, set `BOT_TOKEN` + `MINI_APP_URL`, start the
   `bot` Compose profile, and register the Mini App URL via `/setmenubutton`.
6. Build/sign the Android APK and the Windows cashier installer on suitable
   machines, then run the manual QA checklist in `docs/TESTING.md`.

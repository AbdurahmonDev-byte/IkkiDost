# PROJECT STATUS

Last updated: 2026-11-09 — all implementation phases complete; environment-limited
artifacts (Android APK, Windows EXE, AppImage) documented.

## Legend
- ✅ done · 🟡 in progress / partial · ⬜ not started

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1. Repo inspection | Environment & tooling audit | ✅ |
| 2. Architecture & docs | Monorepo skeleton, docs, decision log | ✅ |
| 3. Backend core | NestJS, Prisma schema, migrations, auth, RBAC, seed | ✅ |
| 4. Business workflows | Products, images, rooms/sessions, orders, service fee, delivery, payments | ✅ |
| 5. Kitchen app + realtime | chef-web, Socket.IO events, push fallback | ✅ |
| 6. Android app | Expo app: waiter + owner interfaces | ✅ code + bundle; ⬜ APK (no SDK) |
| 7. Cashier desktop | Tauri 2 + React billing UI | ✅ UI + Linux packages; ⬜ Windows EXE (needs Windows) |
| 8. Admin panel | All 15 sections + reports | ✅ |
| 9. Tests & integration | Unit/integration/E2E critical flows | ✅ backend 45/45; manual UI smoke |
| 10. Deliverables | Deployment docs, build instructions | ✅ (limitations documented) |
| 11. Telegram bot | Omni-device staff bot (rooms, orders, kitchen, delivery, stats, alerts) | ✅ |

Docs: `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md`,
`docs/DEPLOYMENT.md`, `docs/TESTING.md`, plus `DECISIONS.md`.

## Verification snapshot

- `npm run typecheck` — passes for all 9 workspaces.
- Backend: `cd apps/api && npx vitest run` — **45/45 tests pass**.
- `npm run build -w @ikki-dost/api` — passes.
- `npm run build -w @ikki-dost/admin-web` — passes (20 routes).
- `npm run build -w @ikki-dost/chef-web` — passes.
- `npm run build -w @ikki-dost/cashier-desktop` — `tsc` + Vite pass.
- `cd apps/mobile && npx tsc --noEmit` — passes.
- `npx expo export --platform android --no-bytecode` — passes
  (926 modules, 1.57 MB bundle, 10 assets).
- Live smoke tests were run against the API for admin, chef, and cashier
  previews; mobile was validated by typecheck + production bundle export.

## Implemented

### Backend (`apps/api`)
- Embedded PostgreSQL bootstrap for dev/tests (`npm run db:start`), Prisma schema
  plus 2 migrations.
- Seed: owner/ofitsiant/oshpaz/kassir, 3 rooms, 4 categories, all 14 specified
  products with exact names/prices/units, Naqd/Karta methods, service fee
  4 000 UZS/person enabled for both order types.
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

### Chef kitchen app (`apps/chef-web`)
iPhone-Safari-first kitchen screen, realtime queue, item status updates, Web Push
fallback, PWA manifest/service worker/icon. Production build passes and was
verified end-to-end against the live API.

### Cashier desktop (`apps/cashier-desktop`)
Two-pane bills, partial/full payments, payment methods, idempotency keys,
reversals, session close with owner override, delivery transitions, 80 mm
printable receipt. Vite build passes. Tauri 2 Linux build produced:
- `src-tauri/target/release/ikki-dost-cashier` (≈11 MB)
- `bundle/deb/Ikki Do'st Kassir_0.1.0_amd64.deb` (≈2.9 MB)
- `bundle/rpm/Ikki Do'st Kassir-0.1.0-1.x86_64.rpm` (≈2.95 MB)

### Mobile app (`apps/mobile`)
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

## Known limitations of this environment

- **No Android SDK** → no APK/AAB. The JavaScript bundle is validated by
  `expo export`; build the APK with EAS or Android Studio (see DEPLOYMENT §8).
- **Windows** is required for the cashier `.exe`/`.msi`; Linux builds cannot
  cross-compile Tauri. Linux binary + `.deb` + `.rpm` exist.
- **AppImage** bundling failed while downloading `linuxdeploy-plugin-appimage`
  (network restriction). Retry on an unrestricted machine.
- **No automated browser UI suite** (Playwright/Cypress); frontends were checked
  by production builds and manual smoke tests against the live API.
- **No load testing**; single-node deployment is the target (ADR-008).
- No Docker configuration was added in this environment (no Docker available);
  systemd/PM2 + nginx instructions are in `docs/DEPLOYMENT.md`.

## Next steps for the owner

1. Change the seeded owner password and create real staff accounts.
2. Upload real product images and confirm prices/units with the 14 products.
3. Configure rooms and the service fee policy.
4. Deploy per `docs/DEPLOYMENT.md`; enable HTTPS, backups, VAPID push.
5. Build/sign the Android APK and the Windows cashier installer on suitable
   machines, then run the manual QA checklist in `docs/TESTING.md`.

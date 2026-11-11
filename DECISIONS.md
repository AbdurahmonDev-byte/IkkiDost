# DECISIONS — Architecture Decision Records

## ADR-001: Monorepo with npm workspaces
- **Context:** pnpm/bun unavailable; npm 12 is installed and supports workspaces.
- **Decision:** Use npm workspaces (`apps/*`, `packages/*`).
- **Consequences:** Simple, no extra tooling; slightly slower installs than pnpm. Metro (Expo) needs monorepo config (`watchFolders` + nodeModulesPaths).

## ADR-002: Embedded PostgreSQL for local development
- **Context:** PostgreSQL is not installed; installing system packages requires consent and mutates the OS. Docker unavailable.
- **Decision:** Use `embedded-postgres` (real PostgreSQL binaries downloaded into the project's `.pgdata/`, port 5433) for dev and integration tests. Production uses a standard system/managed PostgreSQL via `DATABASE_URL`.
- **Consequences:** Real PostgreSQL semantics (not SQLite) in dev/tests; zero system changes; `.pgdata/` gitignored.

## ADR-003: Backend-first sequencing
- **Decision:** Fully working backend + DB + tests first; then chef-web, admin-web, cashier-desktop UI, Expo mobile. APK/EXE artifacts documented, not built (no Android SDK / Windows cross-compile toolchain in this environment).

## ADR-004: Integer UZS money
- **Decision:** All monetary values are integer UZS (`Int`) end-to-end: Prisma schema, shared types, Zod schemas, calculations. Quantities for weight-based products are stored as `Decimal` (Prisma `Decimal`, e.g. 0.750 kg) and line totals are rounded to integer UZS at computation time (half-up).
- **Consequences:** No float money errors; quantity precision preserved.

## ADR-005: Historical snapshots
- **Decision:** `OrderItem` stores `productName`, `productUnit`, `unitPrice` (UZS), `lineTotal`. Orders store `serviceFeeAmount` snapshot + `serviceFeePerPerson` snapshot. Later product/setting changes never mutate historical records.
- **Consequences:** Financial history stays accurate; product renames/price changes are safe.

## ADR-006: AuthN/Z
- **Decision:** JWT access (15m) + rotating refresh tokens (30d, hashed at rest, reuse detection revokes the token family). RBAC enforced server-side with a `@Roles()` guard; permission checks for sensitive actions (quantity editing, refunds, room close override).

## ADR-007: Realtime
- **Decision:** Socket.IO namespace `/rt` with JWT auth middleware; role-aware rooms (`role:OWNER`, `role:CHEF`, `role:CASHIER`, `user:{id}`). Web Push (VAPID) for chef app when browser closed; in-app polling/socket fallback otherwise.

## ADR-008: No Redis initially
- **Context:** Redis unavailable; single-node deployment is the realistic target for this business.
- **Decision:** Use in-process eventing + PostgreSQL. Redis remains an option (documented) if horizontal scaling is ever needed.

## ADR-009: Chef app as Next.js PWA-ready responsive web app
- **Decision:** chef-web is a Next.js app with mobile-first, iPhone-Safari-optimized design (safe-area insets, large touch targets). Same stack as admin-web = shared design system and less tooling.

## ADR-010: Mobile app stack and session storage
- **Context:** The waiter/owner app must run on Android with unreliable Wi-Fi.
- **Decision:** Expo SDK 51 with Expo Router file routes. Session (user + JWT pair) is persisted in `expo-secure-store` (device keychain) via zustand-persist; access tokens are refreshed transparently by wrapping `ApiClient` in a 401-retrying Proxy. API base URL comes from `EXPO_PUBLIC_API_URL` with an Android-emulator fallback (`http://10.0.2.2:3000/api`). No `@expo/vector-icons` or AsyncStorage dependency — icons are glyphs/emoji to avoid the peer-dependency issue in ADR-012.
- **Consequences:** Mobile login is restricted to OWNER/WAITER in-app (backend RBAC still enforces everything). APK/AAB artifacts require an Android SDK or EAS and are not produced in this environment.

## ADR-011: Tauri 2 for the cashier desktop app
- **Decision:** The cashier UI is a plain Vite React app; Tauri 2 provides only the desktop shell (single WebView, no per-app database). Payments require CASHIER/OWNER on the backend, so the desktop app never bypasses the API.
- **Consequences:** Verified Linux build: executable + `.deb` + `.rpm`. AppImage packaging failed on a linuxdeploy plugin download (network). Windows `.exe`/`.msi` must be built on Windows with `npx tauri build`; this is documented, not claimed as built.

## ADR-012: npm monorepo + React Native dependency discipline
- **Context:** npm auto-installed a nested `react-native@0.88.1` under `expo/node_modules` (peer of `@expo/vector-icons`), which broke SDK 51 bundling; `babel-preset-expo` also failed to auto-detect `expo-router` in the workspace.
- **Decision:** `.npmrc` uses `legacy-peer-deps=true` (RN projects install peers explicitly) and the root `package.json` pins `overrides.react-native = 0.74.5`. `apps/mobile/babel.config.js` explicitly enables `expoRouterBabelPlugin` (the preset's own plugin) because `hasModule('expo-router')` cannot resolve across the workspace. `apps/mobile/metro.config.js` maps NodeNext-style `.js` specifiers inside `packages/` back to `.ts`/`.tsx` (same idea as the Next.js `extensionAlias`).
- **Consequences:** Fresh `npm install` reproduces the working tree; the Android bundle export is deterministic.

## ADR-013: Realtime event names in one place
- **Decision:** `RtEvent` in `packages/shared-types` is the single source of truth for Socket.IO event names. admin-web, chef-web, cashier-desktop and mobile subscribe via `Object.values(RtEvent)` (+ literal `notification:new`) instead of hand-written strings. Clients keep polling as a fallback.
- **Consequences:** Renaming an event is a compile-time change across all clients; drift like `payment:created` vs `payment:received` cannot reappear silently.

## ADR-014: Admin delivery settings map to existing backend flags
- **Context:** The specification asks for owner-controlled delivery policy.
- **Decision:** The admin “delivery settings” section drives `ServiceFeeConfig.applyToDelivery` (fee on delivery orders) and per-employee `canCreateDelivery` (who may create delivery orders). No extra backend endpoints were invented.

## ADR-015: Waiters never take payments
- **Decision:** Payment routes are OWNER/CASHIER-only on the backend. The mobile app (OWNER + WAITER) therefore offers payment actions only to owners; waiters see the outstanding balance but must hand off to the cashier. This keeps cash handling audited on one workstation + the owner's hands.

## ADR-016: Telegram bot as an omni-device staff interface
- **Context:** Installing separate mobile or desktop apps on personal employee phones or devices can have friction; Telegram is already universally installed on all devices (Android, iPhone, Windows, Mac, Linux).
- **Decision:** Implement `apps/bot` using grammY as a thin, multi-role client over the existing REST API. The bot keeps NO business logic, no custom database, and no duplicate calculations:
  - RBAC is enforced by backend API tokens per Telegram chat.
  - Money remains integer UZS throughout formatters.
  - Session and delivery status transitions follow existing API endpoints.
  - Notifications are delivered via a non-intrusive background poller.
  - Plain-text passwords sent during `/login` are deleted immediately from the chat.
- **Consequences:** All staff members can interact with the teahouse ecosystem from any device without installing specialized builds. Server-side audit and security remain strictly intact.

## ADR-017: Customer self-service via Telegram Mini App
- **Context:** Guests should be able to order to their room or request home delivery, leave a kitchen note, call a waiter and see a receipt without installing anything. Staff also need one UI that works on any device.
- **Decision:** Build `apps/mini-app` (Vite + React + Tailwind) as a Telegram Mini App served by the API at `/` on the same origin as `/api`. The bot links to it with a `webApp` button (`MINI_APP_URL`); the Mini App reads Telegram user data via `telegram-web-app.js` for attribution.
  - Customer endpoints are public and narrowly scoped: `GET /api/public/menu`, `GET /api/public/rooms`, `GET /api/public/orders/:id`, `POST /api/public/orders`, `POST /api/public/call-waiter`.
  - Public writes are throttled (orders 20/min, call-waiter 6/min).
  - Self-service orders are attributed to a dedicated seeded user `bot` (`Mijoz (Self-service)`), never to a real waiter, keeping audit honest.
  - Notes are attached per order item and reach the kitchen; order totals and service fee are still computed only by the backend.
  - Helmet CSP allows `https://telegram.org` scripts and Telegram iframe embedding (`frame-ancestors`).
- **Consequences:** No separate customer app and no duplicated business logic. The bot remains a thin REST client; the Mini App shares the same API and validations. Offline ordering is not supported.

# ARCHITECTURE

Ikki Do‘st choyxonasi — one backend, one PostgreSQL database, multiple clients
(Telegram bot + Telegram Mini App, owner admin panel).

## 1. System overview

```
                         ┌───────────────────────────────┐
                         │        PostgreSQL 15+         │
                         │  (single database, Prisma)    │
                         └──────────────┬────────────────┘
                                        │
┌───────────────────────────────────────┴───────────────────────────────────────┐
│                            apps/api  (NestJS)                                 │
│  REST /api  ·  Swagger /api/docs  ·  Socket.IO /rt  ·  /uploads               │
│  auth + RBAC guards · Zod validation · transactions · audit log · Web Push     │
│  serves apps/mini-app/dist at / (same origin as /api)                         │
└───┬───────────────────────┬────────────────────────┬──────────────────────────┘
    │ HTTPS/JSON             │ HTTPS/JSON             │ HTTPS/JSON + WS
    ▼                        ▼                        ▼
┌──────────────┐   ┌────────────────────┐   ┌──────────────────┐
│ telegram bot │   │ Telegram Mini App  │   │    admin-web     │
│ grammY       │   │ customer + staff   │   │ OWNER (Next.js)  │
│ all roles    │   │ Vite React         │   │                  │
└──────────────┘   └────────────────────┘   └──────────────────┘
```

- **One business logic layer.** Every client talks to the same API and shares the
  same typed contracts (`packages/shared-types`, `packages/validation`). No
  client has its own database.
- **Customer self-service** goes through narrowly scoped `/api/public/*` routes;
  writes are attributed to a dedicated seeded `bot` actor, never a real waiter.
- **Money is always integer UZS.** Quantities are decimal strings (`"0.750"`).
- **Historical snapshots are immutable.** Order items snapshot product name,
  unit and unit price; orders snapshot the service-fee amount, per-person rate
  and method at creation time.

## 2. Repository layout

```
apps/
  api/              NestJS backend, Prisma schema + migrations + seed,
                    static hosting for the Mini App and /uploads
  admin-web/        Next.js owner panel (15 sections)
  bot/              grammY Telegram bot (thin REST client, all roles)
  mini-app/         Telegram Mini App — customer self-service + staff screens
legacy/
  mobile/           Expo React Native app (OWNER + WAITER)
  chef-web/         Next.js kitchen screen
  cashier-desktop/  Vite React UI wrapped in Tauri 2
packages/
  shared-types/     DTOs, enums, realtime event names
  validation/       Zod request schemas (shared by API and clients)
  utils/            money math, service fee, formatting
  api-client/       typed fetch client used by frontends
  design-system/    shared tokens / Tailwind preset
docs/               architecture, database, API, deployment, testing
```

npm workspaces. Build order is not enforced by npm, so every package either
consumes TypeScript sources directly (Next.js `transpilePackages`, Metro) or is
built before its dependents (`shared-types` → `validation` → `utils` →
`api-client` for the API). The Mini App is built separately and served by the
API as static files.

## 3. Backend modules

| Module | Responsibility |
|---|---|
| `auth` | argon2 password verification, JWT access tokens (15 min), rotating refresh tokens with family reuse detection, login throttling |
| `employees` | OWNER-only staff CRUD, `canCreateDelivery` flag |
| `rooms` | rooms list/CRUD, open room sessions, session detail, close with debt rule |
| `categories` / `products` | catalog CRUD, image upload (sharp → WebP + thumbnail), archive/disable |
| `orders` | dine-in multi-order sessions, delivery orders, item CRUD, item status workflow, cancellation, history |
| `deliveries` | delivery workflow transitions, courier assignment (OWNER) |
| `payments` | full/partial payments, order- or session-level, idempotency keys, reversals |
| `expenses` | owner expenses for profit reporting |
| `settings` | singleton service-fee config |
| `reports` | dashboard + date-range reports (OWNER) |
| `notifications` | per-user notifications, Web Push subscriptions |
| `audit` | audit log read API (OWNER) |
| `realtime` | authenticated Socket.IO gateway + role-aware emitter |
| `public` | unauthenticated but narrow customer endpoints (`/public/menu`, `/public/rooms`, `/public/orders`, `/public/call-waiter`), throttled |
| `storage` | file storage abstraction for product images |

Each domain service owns its transactions. Money-changing operations
(order creation, payment, reversal, session close) run inside
`prisma.$transaction` and update cached totals (`Order.paidAmount`,
`RoomSession.totalAmount`, `RoomSession.paidAmount`) atomically.

## 4. Authentication and authorization

```
POST /api/auth/login      → { accessToken, refreshToken, user }
POST /api/auth/refresh    → rotates refresh token, returns new pair
POST /api/auth/logout     → revokes the presented refresh token
GET  /api/auth/me         → current user
```

- Access token: JWT, `type: "access"`, 15-minute TTL, sent as
  `Authorization: Bearer <token>`.
- Refresh token: opaque random string, stored **hashed** in `RefreshToken`,
  grouped by `familyId`. Reuse of an already-rotated token revokes the whole
  family (theft detection).
- Socket.IO clients authenticate with `auth: { token: <accessToken> }` on
  namespace `/rt`; invalid sockets are disconnected immediately.
- **The server enforces every rule**; frontends only hide unavailable actions.

| Capability | OWNER | WAITER | CHEF | CASHIER |
|---|---|---|---|---|
| Admin panel (`admin-web`) | ✅ | — | — | — |
| Mini App staff screens | ✅ | ✅ rooms | ✅ kitchen | ✅ rooms |
| Telegram bot | ✅ | ✅ | ✅ kitchen | ✅ rooms/delivery |
| Rooms / sessions read | ✅ | ✅ | — | ✅ |
| Create dine-in/delivery orders, add items | ✅ | ✅ | — | — |
| Kitchen item status | ✅ | ✅ (serve) | ✅ | — |
| Payments / reversals | ✅ | — | — | ✅ |
| Close room session | ✅ | — | — | ✅ |
| Close session with debt | ✅ + reason + audit | — | — | — |
| Catalog / employees / settings / reports | ✅ | read menu | — | read menu |
| Public self-service ordering | anyone via `/api/public/*` (throttled) | | | |

Waiter delivery creation additionally requires the per-user
`canCreateDelivery` flag (OWNER bypasses it).

## 5. Business workflows

### 5.1 Dine-in room session

1. Waiter opens a room and submits people count + first order items.
2. `RoomsService.getOrCreateOpenSession` locks the `Room` row
   (`SELECT … FOR UPDATE`) and reuses the existing OPEN session or creates one.
   The row lock replaces a database unique constraint, because a room may have
   many CLOSED sessions but at most one OPEN one.
3. Additional orders can be added to the same session; each order snapshots its
   own service fee based on that order's people count.
4. Payments can target a specific order or the whole session. Session totals are
   updated transactionally.
5. Closing an OPEN session with `outstandingAmount > 0` is rejected for
   WAITER/CASHIER. OWNER may override with a reason; actor, reason and amounts
   are written to `AuditLog`. Closing a settled session marks orders completed.

### 5.2 Delivery

```
PENDING → CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED
        ↘ CANCELLED (allowed while not delivered)
```

- Customer name/phone/address live on `Delivery` (1:1 with `Order`).
- `Delivery` status and `Order` status are kept in sync by the deliveries
  service.
- OWNER may assign a courier; OWNER/WAITER/CASHIER may advance status.
- Delivery orders use the same item/fee/payment pipeline as dine-in orders.

### 5.3 Payments

- `POST /api/payments/order/:orderId` or `/session/:sessionId`.
- Amount must be positive integer UZS and may not exceed the outstanding
  balance. Duplicate `idempotencyKey` returns the original result rather than
  charging twice.
- `POST /api/payments/:id/reverse` records a `PaymentReversal` with a mandatory
  reason, marks `reversedAt`, and recalculates cached totals. Reversal is
  audited; the original payment row is never deleted.

### 5.4 Service fee

- Config singleton: `enabled`, `amountPerPerson` (default 4 000 UZS),
  `applyToDineIn`, `applyToDelivery`, `method: PER_PERSON`.
- At order creation the API snapshots `serviceFeePerPerson`,
  `serviceFeeMethod` and the computed `serviceFeeAmount`.
- Adding items to an existing order does **not** recompute the fee.
- Later config changes affect only new orders.

## 6. Realtime

- Socket.IO namespace `/rt`, JWT-authenticated.
- Sockets join `role:{ROLE}` and `user:{id}` rooms; all emission goes through
  `RealtimeService` (`emitToRoles`, `emitToUser`, `emitToUsers`, `emitToAll`).
- Event names are defined once in `packages/shared-types` (`RtEvent`):

| Event | Meaning |
|---|---|
| `order:created` | new order (kitchen alert) |
| `order:updated` / `order:cancelled` | order header change |
| `item:preparing` / `item:ready` / `item:served` | item workflow |
| `order:ready` | all active items ready |
| `payment:received` / `payment:reversed` | money events |
| `room:session-opened` / `room:session-closed` | room lifecycle |
| `room:balance-changed` | session totals changed |
| `delivery:status-changed` | delivery workflow |
| `product:updated` | catalog change |
| `notification:new` | per-user notification (also pushed via Web Push) |

Clients invalidate their query caches on these events and keep **polling as a
fallback** if the socket drops (important on unstable mobile networks).

## 7. Frontend architecture

- admin-web: Next.js App Router, Tailwind, shared design tokens.
- **Mini App** (`apps/mini-app`): Vite + React 18 + Tailwind + lucide-react.
  Built to `dist/` and served by the API at `/` (same origin → `/api` and
  `/uploads` work without CORS). Loads `telegram-web-app.js`, uses Telegram
  haptics/theme, and exposes:
  - customer mode: menu, cart, room/delivery choice, people count + fee preview,
    per-item kitchen notes, order tracker (5 s polling), expandable e-receipt,
    call-waiter modal;
  - staff mode: login modal, kitchen queue, waiter room list, owner dashboard.
- **Bot** (`apps/bot`): grammY long-polling client. JSON-file session store
  (`apps/bot/data/sessions.json`, gitignored) holds JWT pairs per Telegram chat.
  Inline keyboards map to the REST API; a background poller forwards
  notifications. All business rules stay in the API.
- `packages/api-client` remains for admin-web and legacy apps; the bot and Mini
  App use their own small typed fetch wrappers to keep their runtimes free of
  workspace-package build issues.

## 8. Security

- Helmet with a CSP tuned for Telegram: `script-src 'self' https://telegram.org`,
  `frame-ancestors` allows Telegram Web; `object-src 'none'`.
- Strict CORS allow-list (`CORS_ORIGINS`), global exception filter.
- Public customer endpoints are `@Public()` but throttled (orders 20/min,
  call-waiter 6/min) and validated with the same Zod schemas as staff routes.
- Zod validation at the API boundary; Prisma parameterises all SQL.
- Passwords hashed with argon2; refresh tokens stored hashed.
- Upload validation: MIME allow-list, 5 MB limit, random filenames, sharp
  re-encoding to WebP (prevents polyglot/script payloads).
- Audit log for destructive/financial actions (price changes, reversals,
  session close override, cancellations). Self-service orders are attributed to
  the dedicated `bot` actor.
- Secrets never committed; `.env` is gitignored, `.env.example` documents keys.

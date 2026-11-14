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
  remote orders are delivery-only, require a Telegram-verified customer, and are
  attributed to a dedicated seeded `bot` actor, never a real waiter.
- **Staff authentication** resolves the employee role from the owner-assigned
  Telegram ID. Mini App `initData` is signature-validated with `BOT_TOKEN`;
  the bot uses the verified Telegram sender ID. Username/password login and
  self-linking are rejected for employees. All roles, including OWNER (resolved
  through `OWNER_TELEGRAM_IDS`), log in passwordlessly.
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
| `auth` | argon2 password verification, Telegram `initData` login/linking, JWT access tokens (15 min), rotating refresh tokens with family reuse detection, login throttling |
| `employees` | OWNER-only staff CRUD, `canCreateDelivery`, Telegram identity fields |
| `rooms` | rooms list/CRUD, open room sessions, session detail, close with debt rule |
| `categories` / `products` | catalog CRUD, image upload (sharp → WebP + thumbnail), archive/disable |
| `orders` | dine-in multi-order sessions, delivery orders, item CRUD, item status workflow, cancellation, history |
| `deliveries` | delivery workflow transitions, courier claim/assignment (DELIVERY/OWNER) |
| `payments` | full/partial payments, order- or session-level, idempotency keys, reversals |
| `expenses` | owner expenses for profit reporting |
| `settings` | singleton service-fee config |
| `reports` | dashboard + date-range reports (OWNER) |
| `notifications` | per-user notifications, Web Push subscriptions |
| `audit` | audit log read API (OWNER) |
| `realtime` | authenticated Socket.IO gateway + role-aware emitter |
| `public` | unauthenticated but narrow customer endpoints (menu, rooms, registration, phone verification, delivery orders, call-waiter), throttled; Telegram identity validated with `BOT_TOKEN` |
| `storage` | file storage abstraction for product images |

Each domain service owns its transactions. Money-changing operations
(order creation, payment, reversal, session close) run inside
`prisma.$transaction` and update cached totals (`Order.paidAmount`,
`RoomSession.totalAmount`, `RoomSession.paidAmount`) atomically.

## 4. Authentication and authorization

```
POST /api/auth/login           → OWNER bootstrap or dedicated backend bot actor
POST /api/auth/telegram        → Mini App auto-login from validated initData
POST /api/auth/telegram/bot    → bot auto-login by Telegram id (bot secret)
POST /api/auth/link-telegram   → OWNER-only legacy/bootstrap link
POST /api/auth/refresh         → rotates refresh token, returns new pair
POST /api/auth/logout          → revokes the presented refresh token
GET  /api/auth/me              → current user
```

- Telegram `initData` is HMAC-validated with `BOT_TOKEN` and rejected when older
  than `TELEGRAM_AUTH_MAX_AGE_SECONDS` (default 86 400).
- OWNER assigns each employee's Telegram ID in the employee manager or the
  Mini App owner tab. The role is resolved from that ID; employee password
  login and self-linking are rejected.
- Every role, including OWNER (resolved from `OWNER_TELEGRAM_IDS`), logs in
  passwordlessly; no extra owner password is requested.
- Bot-only routes require `x-bot-secret: <BOT_TOKEN>`.
- Access token: JWT, `type: "access"`, 15-minute TTL, sent as
  `Authorization: Bearer <token>`.
- Refresh token: opaque random string, stored **hashed** in `RefreshToken`,
  grouped by `familyId`. Reuse of an already-rotated token revokes the whole
  family (theft detection).
- Socket.IO clients authenticate with `auth: { token: <accessToken> }` on
  namespace `/rt`; invalid sockets are disconnected immediately.
- **The server enforces every rule**; frontends only hide unavailable actions.

| Capability | OWNER | WAITER | CHEF | CASHIER | DELIVERY |
|---|---|---|---|---|---|
| Admin panel (`admin-web`) | ✅ | — | — | — | — |
| Mini App staff screens | ✅ | ✅ rooms | ✅ kitchen | ✅ rooms + cashier | ✅ deliveries |
| Telegram bot | ✅ | ✅ | ✅ kitchen | ✅ rooms/delivery/cashier | ✅ deliveries |
| Rooms / sessions read | ✅ | ✅ | — | ✅ | — |
| Create dine-in orders, add items | ✅ | ✅ | — | — | — |
| Create delivery orders | ✅ | ✅ + flag | — | — | — |
| Kitchen item status | ✅ | ✅ (serve) | ✅ | — | — |
| Claim / advance delivery | ✅ | advance | — | advance | ✅ claim + hand-off |
| Payments / reversals | ✅ | — | — | ✅ | — |
| Close room session | ✅ | — | — | ✅ | — |
| Close session with debt | ✅ + reason + audit | — | — | — | — |
| Catalog / employees / settings / reports | ✅ | read menu | — | read menu | read menu |
| Customer registration/delivery ordering | registered Telegram customers via `/api/public/*` (throttled) | | | | |

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

- Customer name/phone/address live on `Delivery` (1:1 with `Order`); remote
  orders additionally link to the registered `Customer` (`Order.customerId`).
- `Delivery` status and `Order` status are kept in sync by the deliveries
  service. Kitchen readiness (`READY`) automatically propagates to the delivery.
- DELIVERY staff see their own deliveries plus claimable unassigned ones
  (`CONFIRMED`/`PREPARING`/`READY`), claim one, and may set only
  `OUT_FOR_DELIVERY` / `DELIVERED`.
- OWNER may assign a courier and override; OWNER/WAITER/CASHIER may advance
  status. Claims and overrides are audited.
- Delivery orders use the same item/fee/payment pipeline as dine-in orders.
- Remote orders originate from `/api/public/orders` (delivery-only) and require
  a registered customer with a Telegram-verified phone. The submitted address
  is persisted to `Customer.deliveryAddress` for the next checkout; the bot asks
  for a Telegram location (or manual text) and saves it through the bot-only
  `PATCH /api/public/customers/bot`.
- **Cash reconciliation:** on `DELIVERED` the courier records
  `cashCollectedAmount` (default = outstanding, capped at it). The balance is
  unchanged until CASHIER/OWNER call `POST /api/deliveries/:id/handover`, which
  records a CASH payment with idempotency key `delivery-cash-<deliveryId>`, sets
  `cashHandedOverAt`, audits `DELIVERY_CASH_HANDED_OVER` and notifies the
  courier. Pending handovers are surfaced in the bot delivery list and the Mini
  App “Kassa” tab.

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

### 5.5 Customer registration and receipts

1. The Mini App sends `initData` to `/api/public/me`. If no linked `Customer`
   exists, the registration screen asks for first/last name and a phone number.
2. Phone verification uses Telegram contact sharing. The bot (or an API-triggered
   message) shows a `request_contact` keyboard; the received contact must belong
   to the same Telegram user (`contactUserId`). The phone is stored and
   `phoneVerifiedAt` is set.
3. Only registered + verified customers may place remote orders. Receipts are
   rendered client-side from the order DTO with print CSS; no totals are
   recomputed in the client.

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
  - customer mode: redesigned menu/search, cart, delivery-only remote orders,
    mandatory registration + phone verification gate, per-item kitchen notes,
    order tracker (5 s polling), printable e-receipt, call-waiter modal;
  - staff mode: Telegram auto-login for every role (plus one-time owner
    bootstrap link), role tabs for rooms, kitchen, deliveries, cashier and
    owner management (products, photos, categories, stats). OWNER opens on the
    normal customer screen and switches to the owner panel via the “Ega” tab.
- **Bot** (`apps/bot`): grammY long-polling client. JSON-file session store
  (`apps/bot/data/sessions.json`, gitignored) holds JWT pairs per Telegram chat.
  Inline keyboards map to the REST API; a background poller forwards
  notifications. Customer registration/contact verification happens in the bot;
  ordering itself is Mini App only. All business rules stay in the API.
- `packages/api-client` remains for admin-web and legacy apps; the bot and Mini
  App use their own small typed fetch wrappers to keep their runtimes free of
  workspace-package build issues.

## 8. Security

- Helmet with a CSP tuned for Telegram: `script-src 'self' https://telegram.org`,
  `frame-ancestors` allows Telegram Web; `object-src 'none'`.
- Strict CORS allow-list (`CORS_ORIGINS`), global exception filter.
- Public customer endpoints are `@Public()` but throttled (registration 10/min,
  orders 20/min, call-waiter 6/min) and validated with the same Zod schemas as
  staff routes. Telegram `initData` is HMAC-validated with `BOT_TOKEN`; bot-only
  routes also require `x-bot-secret`.
- Customer data access is scoped: `GET /public/orders/:id` only returns orders
  whose `customerId` matches the authenticated Telegram customer.
- Zod validation at the API boundary; Prisma parameterises all SQL.
- Passwords hashed with argon2; refresh tokens stored hashed.
- Upload validation: MIME allow-list, 5 MB limit, random filenames, sharp
  re-encoding to WebP (prevents polyglot/script payloads).
- Audit log for destructive/financial actions (price changes, reversals,
  session close override, cancellations). Self-service orders are attributed to
  the dedicated `bot` actor.
- Secrets never committed; `.env` is gitignored, `.env.example` documents keys.

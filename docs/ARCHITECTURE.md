# ARCHITECTURE

Ikki Do‘st choyxonasi — one backend, one PostgreSQL database, five clients.

## 1. System overview

```
                         ┌───────────────────────────────┐
                         │        PostgreSQL 15+         │
                         │  (single database, Prisma)    │
                         └──────────────┬────────────────┘
                                        │
┌───────────────────────────────────────┴───────────────────────────────────────┐
│                            apps/api  (NestJS)                                 │
│  REST /api  ·  Swagger /api/docs  ·  Socket.IO namespace /rt  ·  /uploads     │
│  auth + RBAC guards · Zod validation · transactions · audit log · Web Push    │
└───┬───────────────┬────────────────┬─────────────────┬───────────────┬────────┘
    │ HTTPS/JSON    │ HTTPS/JSON     │ HTTPS/JSON      │ HTTPS/JSON    │ WS + JSON
    ▼               ▼                ▼                 ▼               ▼
┌─────────┐   ┌───────────┐   ┌────────────┐   ┌──────────────┐  ┌───────────┐
│admin-web│   │ chef-web  │   │mobile Expo │   │cashier (Tauri)│  │ realtime  │
│ OWNER   │   │ CHEF+OWNER│   │OWNER+WAITER│   │CASHIER+OWNER  │  │  clients  │
│ Next.js │   │ Next.js   │   │ React Native│  │ React + Vite  │  │           │
└─────────┘   └───────────┘   └────────────┘   └──────────────┘  └───────────┘
```

- **One business logic layer.** Every client talks to the same API and shares the
  same typed contracts (`packages/shared-types`, `packages/validation`) and the
  same API client (`packages/api-client`). No client has its own database.
- **Money is always integer UZS.** Quantities are decimal strings (`"0.750"`).
- **Historical snapshots are immutable.** Order items snapshot product name,
  unit and unit price; orders snapshot the service-fee amount, per-person rate
  and method at creation time.

## 2. Repository layout

```
apps/
  api/              NestJS backend, Prisma schema + migrations + seed
  admin-web/        Next.js owner panel (15 sections)
  chef-web/         Next.js kitchen screen (iPhone Safari, PWA + Web Push)
  mobile/           Expo SDK 51 router app (OWNER + WAITER)
  cashier-desktop/  Vite React UI wrapped in Tauri 2
packages/
  shared-types/     DTOs, enums, realtime event names
  validation/       Zod request schemas (shared by API and clients)
  utils/            money math, service fee, formatting
  api-client/       typed fetch client used by every frontend
  design-system/    shared tokens / Tailwind preset
docs/               architecture, database, API, deployment, testing
```

npm workspaces. Build order is not enforced by npm, so every package either
consumes TypeScript sources directly (Next.js `transpilePackages`, Metro) or is
built before its dependents (`shared-types` → `validation` → `utils` →
`api-client` for the API).

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
| Kitchen screen (`chef-web`) | ✅ | — | ✅ | — |
| Mobile app (`mobile`) | ✅ | ✅ | — | — |
| Cashier app (`cashier-desktop`) | ✅ | — | — | ✅ |
| Rooms / sessions read | ✅ | ✅ | — | ✅ |
| Create dine-in/delivery orders, add items | ✅ | ✅ | — | — |
| Kitchen item status | ✅ | ✅ (serve) | ✅ | — |
| Payments / reversals | ✅ | — | — | ✅ |
| Close room session | ✅ | — | — | ✅ |
| Close session with debt | ✅ + reason + audit | — | — | — |
| Catalog / employees / settings / reports | ✅ | read menu | — | read menu |

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

- All clients share `@ikki-dost/api-client` (fetch, bearer injection, typed
  errors) and `@ikki-dost/shared-types`.
- TanStack Query owns server state; Zustand owns local session/UI state.
- admin-web / chef-web: Next.js App Router, Tailwind, shared design tokens.
- chef-web is a PWA (manifest + service worker) with Web Push; optimised for
  iPhone Safari safe areas and large touch targets.
- mobile: Expo Router file routes, SecureStore-persisted JWT session,
  Zustand + TanStack Query, Socket.IO realtime. API base URL is configurable
  (`EXPO_PUBLIC_API_URL`); Android emulator defaults to `10.0.2.2:3000`.
- cashier-desktop: the same React UI runs in a browser during development and
  inside Tauri 2 in production; Tauri only provides the desktop shell.

## 8. Security

- Helmet, strict CORS allow-list (`CORS_ORIGINS`), global exception filter.
- Zod validation at the API boundary; Prisma parameterises all SQL.
- Passwords hashed with argon2; refresh tokens stored hashed.
- Upload validation: MIME allow-list, 5 MB limit, random filenames, sharp
  re-encoding to WebP (prevents polyglot/script payloads).
- Audit log for destructive/financial actions (price changes, reversals,
  session close override, cancellations).
- Secrets never committed; `.env` is gitignored, `.env.example` documents keys.

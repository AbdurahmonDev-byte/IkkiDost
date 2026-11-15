# API

Base URL: `http://<host>:3000/api`
Swagger UI: `http://<host>:3000/api/docs`
Realtime: Socket.IO namespace `/rt` on the same origin.

All request/response bodies are JSON (except product image uploads, which are
`multipart/form-data`). Money is integer UZS. Quantities are decimal strings.

## 1. Authentication

Header: `Authorization: Bearer <accessToken>` for every protected route.

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "owner", "password": "<owner-password>" }
```

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "user": {
    "id": "…", "username": "ofitsiant", "fullName": "…",
    "role": "WAITER", "isActive": true
  }
}
```

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | public (10/min) | OWNER bootstrap, CASHIER admin access, or backend `bot` actor |
| POST | `/auth/telegram` | public (30/min) | Passwordless Mini App login with signed `initData` |
| POST | `/auth/telegram/bot` | public + `x-bot-secret` (60/min) | Bot auto-login by `telegramId` |
| POST | `/auth/link-telegram` | public (15/min) | OWNER-only legacy/bootstrap link; employees must be assigned by OWNER |
| POST | `/auth/refresh` | public (30/min) | Rotate refresh token |
| POST | `/auth/logout` | public | Revoke the presented refresh token |
| GET | `/auth/me` | any role | Current user |

Refresh body: `{ "refreshToken": "…" }`. Reusing an already-rotated refresh
token revokes the whole token family.

Telegram login body:

```json
{ "initData": "<Telegram.WebApp.initData>" }
```

`initData` is HMAC-validated with `BOT_TOKEN` and must be newer than
`TELEGRAM_AUTH_MAX_AGE_SECONDS` (default 86 400). The identity is matched to an
employee account, or to the owner account when it is listed in
`OWNER_TELEGRAM_IDS`. Every role, including OWNER, logs in without a password.
Errors carry a machine-readable `details.code`:

- `TELEGRAM_NOT_LINKED` — the Telegram identity is not bound to a staff account;
  the owner must assign the ID in the employee manager.

Link body (Mini App): `{ "initData": "…", "username": "…", "password": "…" }`.
Link body (bot): `{ "telegramId": "…", "telegramUsername": "…", "username": "…", "password": "…" }`
plus `x-bot-secret: <BOT_TOKEN>`. This route is only for the OWNER bootstrap /
legacy credential migration; employees are assigned an ID by the owner and log
in directly with `/auth/telegram` (passwordless for every role).

Bot-only endpoints require `x-bot-secret: <BOT_TOKEN>`; never send that header
from a browser.

## 2. Error format

```json
{
  "statusCode": 409,
  "message": "Xona sessiyasida qarz mavjud",
  "error": "Conflict",
  "details": null
}
```

- `400` validation error (Zod messages are user-facing Uzbek).
- `401` missing/expired token.
- `403` role or permission denied.
- `404` not found.
- `409` business-rule conflict (debt, duplicate payment, invalid transition).
- `429` rate limited.

## 3. Endpoint reference

Role lists show who may call the route. OWNER is allowed wherever explicitly
listed; it is not implicitly added to every route.

### Employees (OWNER, CASHIER)

| Method | Path | Body / query |
|---|---|---|
| GET | `/employees` | — |
| POST | `/employees` | `{ username, password, fullName, phone?, role, canCreateDelivery?, telegramId, telegramUsername? }` |
| PATCH | `/employees/:id` | partial employee fields, `isActive`, `password?`, Telegram fields |

`role` is one of `OWNER`, `WAITER`, `CHEF`, `CASHIER`, `DELIVERY`. The owner
assigns each employee's numeric `telegramId` in the employee manager (also
available in the Mini App owner tab). The API resolves the employee and role
from this ID. WAITER, CHEF and DELIVERY cannot log in with username/password or
link their own ID. CASHIER may use an owner-configured password for admin-web;
all roles can still use their assigned Telegram ID. OWNER signs in with an
allowlisted Telegram ID and no extra password. `/auth/login` is also available
for OWNER bootstrap and the dedicated backend `bot` actor.

`PATCH /employees/:id` lets the owner or cashier change employee `role`, name/phone,
or `isActive` flag, and reassign the Telegram ID without deleting history.
Deactivating the last active OWNER is rejected; a Telegram ID reserved for the
owner cannot be assigned to another role.

### Rooms and sessions

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/rooms` | OWNER, WAITER, CASHIER | includes `activeSession` summary |
| POST | `/rooms` | OWNER, CASHIER | `{ name, isActive? }` |
| PATCH | `/rooms/:id` | OWNER, CASHIER | `{ name?, isActive? }` |
| GET | `/rooms/sessions/:sessionId` | OWNER, WAITER, CASHIER | summary + `orders` + `payments` |
| POST | `/rooms/sessions/:sessionId/close` | OWNER, CASHIER | `{ overrideReason? }` (reason required when debt remains) |

Session detail response:

```json
{
  "id": "…", "status": "OPEN", "openedAt": "…",
  "orderCount": 2, "totalAmount": 90000, "paidAmount": 40000,
  "outstandingAmount": 50000, "orders": [], "payments": []
}
```

### Categories and products

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/categories` | any role | `[{ id, name, sortOrder, productCount? }]` |
| POST | `/categories` | OWNER, CASHIER | `{ name, sortOrder? }` |
| PATCH | `/categories/:id` | OWNER, CASHIER | partial |
| GET | `/products` | any role | `?includeArchived=true&categoryId=…` |
| POST | `/products` | OWNER, CASHIER | `{ name, categoryId, unit, price, costPrice? }` (`costPrice` defaults to 0) |
| PATCH | `/products/:id` | OWNER, CASHIER | name/categoryId/unit/price/costPrice/status |
| POST | `/products/:id/image` | OWNER, CASHIER | multipart field `image` (JPEG/PNG/WebP ≤ 5 MB) |
| DELETE | `/products/:id/image` | OWNER, CASHIER | removes stored file + row |

Image URLs in responses are relative (`/uploads/…`, `/uploads/thumbs/…`);
prefix the API origin.

### Orders

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/orders` | OWNER, WAITER, CASHIER | `?status=&type=&active=true` |
| GET | `/orders/kitchen` | CHEF, OWNER | active kitchen queue |
| GET | `/orders/:id` | any role | |
| GET | `/orders/:id/history` | any role | status transitions |
| POST | `/orders` | OWNER, WAITER, CASHIER | create order (dine-in or delivery) |
| POST | `/orders/:id/items` | OWNER, WAITER, CASHIER | `{ items: [{ productId, quantity, note? }] }` |
| PATCH | `/orders/:id/items/:itemId` | OWNER, WAITER, CASHIER | `{ quantity?, note? }` |
| POST | `/orders/:id/items/:itemId/status` | OWNER, WAITER, CHEF, CASHIER | `{ status: "PREPARING" \| "READY" \| "SERVED" }` |
| POST | `/orders/:id/cancel` | OWNER, WAITER, CASHIER | `{ reason }` |

Dine-in body:

```json
{
  "type": "DINE_IN",
  "roomId": "…",
  "numberOfPeople": 4,
  "note": null,
  "items": [
    { "productId": "…", "quantity": "1" },
    { "productId": "…", "quantity": "0.750", "note": "yaxshi qovurilsin" }
  ]
}
```

Delivery body adds:

```json
{
  "type": "DELIVERY",
  "numberOfPeople": 2,
  "items": [{ "productId": "…", "quantity": "1" }],
  "customerName": "Ali",
  "customerPhone": "+998901234567",
  "address": "Chilonzor 5-42",
  "note": null
}
```

Waiter accounts need `canCreateDelivery` to create delivery orders.

### Deliveries

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/deliveries` | OWNER, WAITER, CASHIER, DELIVERY | `?status=` (DELIVERY sees own + claimable) |
| GET | `/deliveries/:id` | OWNER, WAITER, CASHIER, DELIVERY | |
| POST | `/deliveries/:id/claim` | OWNER, CASHIER, DELIVERY | claims an unassigned `CONFIRMED`/`PREPARING`/`READY` delivery |
| POST | `/deliveries/:id/status` | OWNER, WAITER, CASHIER, DELIVERY | `{ status, cashCollectedAmount? }` |
| POST | `/deliveries/:id/handover` | OWNER, CASHIER | `{ methodId?, note? }` — confirms the courier handed over the collected cash |
| POST | `/deliveries/:id/assign` | OWNER, CASHIER | `{ assignedToId }` |

Allowed transitions:
`PENDING → CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED`;
`CANCELLED` is allowed while not delivered. The delivery `id` (not the order
id) is used in these paths.

Delivery DTO cash fields: `cashCollectedAmount`, `cashCollectedAt`,
`cashHandedOverAt` (all nullable), plus the order's `paidAmount`,
`outstandingAmount`, `customerPhone` and `address`.

Cash reconciliation:

- When a courier sets `DELIVERED`, `cashCollectedAmount` records the cash they
  took from the customer. It defaults to the outstanding amount and may not
  exceed it; `0` means the order was paid by card / no cash. The timestamp is
  stored in `cashCollectedAt`.
- `POST /deliveries/:id/handover` is the cashier's “To‘lov qilindi” confirmation.
  It records a `CASH` payment for `min(cashCollectedAmount, outstanding)` (the
  active cash method unless `methodId` is given) with the idempotency key
  `delivery-cash-<deliveryId>`, sets `cashHandedOverAt`, writes a
  `DELIVERY_CASH_HANDED_OVER` audit entry and notifies the courier. A second
  handover returns `400`; a handover with no recorded cash also returns `400`.
- Marking `DELIVERED` with collected cash notifies CASHIER and OWNER
  (`DELIVERY_CASH_PENDING`).

Role rules:

- DELIVERY staff must claim a delivery before changing its status and may only
  set `OUT_FOR_DELIVERY` or `DELIVERED`. Kitchen states are advanced by
  CHEF/OWNER; when the kitchen marks the order ready the delivery becomes
  `READY` automatically.
- A delivery assigned to someone else cannot be updated by another courier.
- `POST /deliveries/:id/claim` writes a `DELIVERY_CLAIMED` audit entry.

### Payments

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/payments` | OWNER, CASHIER | `?from=&to=` ISO dates |
| GET | `/payments/methods` | OWNER, CASHIER, WAITER | |
| POST | `/payments/methods` | OWNER, CASHIER | `{ name, kind }` |
| PATCH | `/payments/methods/:id` | OWNER, CASHIER | `{ name?, kind?, isActive? }` |
| POST | `/payments/order/:orderId` | OWNER, CASHIER | `{ amount, methodId, note?, idempotencyKey? }` |
| POST | `/payments/session/:sessionId` | OWNER, CASHIER | same |
| POST | `/payments/:id/reverse` | OWNER, CASHIER | `{ reason }` |

- `amount` is a positive integer and may not exceed the outstanding balance.
- `idempotencyKey` is client-generated; replaying it returns the original
  payment instead of charging twice.
- The route `:id` for reversal is the **payment** id.
- Waiters cannot take payments (backend-enforced).

### Expenses

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/expenses` | OWNER, CASHIER | `?from=&to=` |
| POST | `/expenses` | OWNER, CASHIER | `{ title, amount, category?, note?, spentAt? }` |
| DELETE | `/expenses/:id` | OWNER, CASHIER | |

### Settings

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/settings/service-fee` | any role | |
| PATCH | `/settings/service-fee` | OWNER, CASHIER | `{ enabled?, amountPerPerson?, applyToDineIn?, applyToDelivery?, method? }` |

Changing the config never modifies existing orders.

### Reports (OWNER, CASHIER)

| Method | Path | Query |
|---|---|---|
| GET | `/reports/dashboard` | — |
| GET | `/reports/summary` | `from`, `to` (ISO dates) |

Report profit is paid revenue minus expenses and sold-item cost snapshots
(`costOfGoods`). The dashboard also returns today's `todayCostOfGoods` and
`todayProfit`.

### Audit (OWNER, CASHIER)

| Method | Path | Query |
|---|---|---|
| GET | `/audit-logs` | `?limit=100` |

### Maintenance (OWNER)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/maintenance/clear-sales-history` | — | Deletes orders, order items, payments, reversals, deliveries, room sessions, sales notifications and their audit rows. Menu, staff, rooms, customers and expenses are kept. Runs in one transaction and writes a `SALES_HISTORY_CLEARED` audit entry. |

Intended for clearing test data before go-live; it is irreversible.

### Public / customer (no auth)

Used by the Telegram Mini App and the registration bot. Telegram identity is
passed as `x-telegram-init-data` (or the `initData` body field) and validated
server-side with `BOT_TOKEN`. Bot-only routes additionally require
`x-bot-secret: <BOT_TOKEN>`.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/public/config` | — | `{ botUsername, botUrl, registrationUrl, remoteOrdering, dineInOrdering }` |
| GET | `/public/menu` | — | `{ categories, products, serviceFee }` |
| GET | `/public/rooms` | — | active rooms + occupancy |
| GET | `/public/me` | — | current customer profile or `null` |
| POST | `/public/register` | `{ firstName, lastName, phone, deliveryAddress? }` | Mini App registration; 10/min |
| POST | `/public/register/bot` | `{ telegramId, firstName, lastName, phone, deliveryAddress?, ... }` | bot-only registration; 60/min |
| POST | `/public/customers/lookup` | `{ telegramId }` | bot-only profile lookup |
| PATCH | `/public/customers/bot` | `{ telegramId, firstName?, lastName?, deliveryAddress? }` | bot-only profile/address patch (Telegram location or manual text); 60/min |
| POST | `/public/verify-phone` | `{ telegramId, phone, contactUserId }` | bot-only; Telegram contact confirmation |
| PATCH | `/public/me` | `{ firstName?, lastName?, phone?, deliveryAddress? }` | update own profile |
| GET | `/public/orders/:id` | — | own order only (status, items, fee, totals) |
| POST | `/public/orders` | `{ type: "DELIVERY", numberOfPeople, items, address, note? }` | delivery-only; requires registered + phone-verified customer; 20/min |
| POST | `/public/call-waiter` | `{ roomId, note? }` | creates a `WAITER_CALLED` notification; 6/min |

Public ordering rules:

- `type` must be `DELIVERY`; dine-in orders cannot be created remotely.
- Customer name and phone come from the verified `Customer` profile — the body
  has no `customerName`/`customerPhone`.
- Unregistered or unverified callers get `403` with
  `details.code = CUSTOMER_NOT_REGISTERED` or `PHONE_NOT_VERIFIED`.
- Orders are attributed to the seeded `bot` actor and linked to the customer
  via `Order.customerId`; other customers cannot read them.
- The submitted `address` is saved to `Customer.deliveryAddress`, so the next
  Mini App checkout and bot `/start` prefill the last used address.
- On-site guests call a waiter instead of ordering from their phone.

Receipts are rendered client-side from `GET /orders/:id` or the order returned
by `POST /public/orders`; there is no separate receipt endpoint. The receipt
shows the immutable snapshots stored on the order.

### Telegram bot secret

Routes marked "bot-only" (`/auth/telegram/bot`, `/auth/link-telegram` with
`telegramId`, `/public/register/bot`, `/public/customers/lookup`,
`/public/customers/bot`, `/public/verify-phone`) require:

```http
x-bot-secret: <BOT_TOKEN>
```

Requests without the exact token receive `401`/`400`. Never expose this header
to browsers or logs.

### Notifications

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/notifications` | any role | current user's notifications |
| POST | `/notifications/:id/read` | any role | |
| POST | `/notifications/read-all` | any role | |
| GET | `/notifications/vapid-key` | public | `{ publicKey }` |
| POST | `/notifications/push-subscription` | any role | `{ endpoint, keys: { p256dh, auth } }` |
| DELETE | `/notifications/push-subscription` | any role | `{ endpoint }` |

## 4. Realtime protocol

Connect:

```js
const socket = io(`${API_ORIGIN}/rt`, {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

Invalid/expired tokens receive `error` and are disconnected. Event names come
from `RtEvent` in `packages/shared-types`:

```
order:created            order:updated           order:cancelled
item:preparing           item:ready              item:served
order:ready              payment:received        payment:reversed
room:session-opened      room:session-closed     room:balance-changed
delivery:status-changed  product:updated         notification:new
```

Payloads are intentionally small (`{ orderId }`, `{ sessionId }`,
`{ deliveryId }`, notification DTO, …). Clients should re-fetch the affected
resource rather than rely on payload completeness.

## 5. Health and docs

- Health: `GET /api/health` → `{ status: 'ok', … }`
- Swagger UI: `GET /api/docs`
- OpenAPI JSON: `GET /api/docs-json`
- Uploaded files: `GET /uploads/…`
- Mini App: `GET /` (the API serves `apps/mini-app/dist`; SPA fallback for
  non-`/api` GET routes)

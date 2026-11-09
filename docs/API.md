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

{ "username": "ofitsiant", "password": "password123" }
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
| POST | `/auth/login` | public (10/min) | Login, returns token pair + user |
| POST | `/auth/refresh` | public (30/min) | Rotate refresh token |
| POST | `/auth/logout` | public | Revoke the presented refresh token |
| GET | `/auth/me` | any role | Current user |

Refresh body: `{ "refreshToken": "…" }`. Reusing an already-rotated refresh
token revokes the whole token family.

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

### Employees (OWNER)

| Method | Path | Body / query |
|---|---|---|
| GET | `/employees` | — |
| POST | `/employees` | `{ username, password, fullName, phone?, role, canCreateDelivery? }` |
| PATCH | `/employees/:id` | partial employee fields, `isActive`, `password?` |

### Rooms and sessions

| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/rooms` | OWNER, WAITER, CASHIER | includes `activeSession` summary |
| POST | `/rooms` | OWNER | `{ name, isActive? }` |
| PATCH | `/rooms/:id` | OWNER | `{ name?, isActive? }` |
| GET | `/rooms/sessions/:sessionId` | OWNER, WAITER, CASHIER | summary + `orders` + `payments` |
| POST | `/rooms/sessions/:sessionId/close` | OWNER, CASHIER | `{ overrideReason? }` (OWNER only when debt remains) |

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
| POST | `/categories` | OWNER | `{ name, sortOrder? }` |
| PATCH | `/categories/:id` | OWNER | partial |
| GET | `/products` | any role | `?includeArchived=true&categoryId=…` |
| POST | `/products` | OWNER | `{ name, categoryId, unit, price }` |
| PATCH | `/products/:id` | OWNER | name/categoryId/unit/price/status |
| POST | `/products/:id/image` | OWNER | multipart field `image` (JPEG/PNG/WebP ≤ 5 MB) |
| DELETE | `/products/:id/image` | OWNER | removes stored file + row |

Image URLs in responses are relative (`/uploads/…`, `/uploads/thumbs/…`);
prefix the API origin.

### Orders

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/orders` | OWNER, WAITER, CASHIER | `?status=&type=&active=true` |
| GET | `/orders/kitchen` | CHEF, OWNER | active kitchen queue |
| GET | `/orders/:id` | any role | |
| GET | `/orders/:id/history` | any role | status transitions |
| POST | `/orders` | OWNER, WAITER | create order (dine-in or delivery) |
| POST | `/orders/:id/items` | OWNER, WAITER | `{ items: [{ productId, quantity, note? }] }` |
| PATCH | `/orders/:id/items/:itemId` | OWNER, WAITER | `{ quantity?, note? }` |
| POST | `/orders/:id/items/:itemId/status` | OWNER, WAITER, CHEF | `{ status: "PREPARING" \| "READY" \| "SERVED" }` |
| POST | `/orders/:id/cancel` | OWNER, WAITER | `{ reason }` |

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
| GET | `/deliveries` | OWNER, WAITER, CASHIER | `?status=` |
| POST | `/deliveries/:id/status` | OWNER, WAITER, CASHIER | `{ status }` |
| POST | `/deliveries/:id/assign` | OWNER | `{ assignedToId }` |

Allowed transitions:
`PENDING → CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED`;
`CANCELLED` is allowed while not delivered. The delivery `id` (not the order
id) is used in these paths.

### Payments

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/payments` | OWNER, CASHIER | `?from=&to=` ISO dates |
| GET | `/payments/methods` | OWNER, CASHIER, WAITER | |
| POST | `/payments/methods` | OWNER | `{ name, kind }` |
| PATCH | `/payments/methods/:id` | OWNER | `{ name?, kind?, isActive? }` |
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
| DELETE | `/expenses/:id` | OWNER | |

### Settings

| Method | Path | Roles | Body |
|---|---|---|---|
| GET | `/settings/service-fee` | any role | |
| PATCH | `/settings/service-fee` | OWNER | `{ enabled?, amountPerPerson?, applyToDineIn?, applyToDelivery?, method? }` |

Changing the config never modifies existing orders.

### Reports (OWNER)

| Method | Path | Query |
|---|---|---|
| GET | `/reports/dashboard` | — |
| GET | `/reports/summary` | `from`, `to` (ISO dates) |

### Audit (OWNER)

| Method | Path | Query |
|---|---|---|
| GET | `/audit-logs` | `?limit=100` |

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

- Swagger UI: `GET /api/docs`
- OpenAPI JSON: `GET /api/docs-json`
- Uploaded files: `GET /uploads/…`

There is no dedicated `/health` route; use `GET /api/auth/me` (401 means the
process is up, credentials are missing) or a TCP/HTTP probe on `/api/docs`.

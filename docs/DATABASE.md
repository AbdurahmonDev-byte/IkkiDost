# DATABASE

PostgreSQL 15+ via Prisma. Source of truth: `apps/api/prisma/schema.prisma`.

## 1. Conventions

- **Money:** integer UZS (`Int`). Never floating point, never `Decimal` for
  money.
- **Quantities:** `Decimal(8,3)` (e.g. `0.750` kg). Serialized by the API as a
  decimal string without trailing zeros (`"0.75"`).
- **IDs:** UUID v4 strings.
- **Timestamps:** `createdAt` / `updatedAt` in UTC (`timestamptz` semantics via
  Prisma `DateTime`).
- **Soft history:** financial rows are never deleted. Reversals/cancellations
  add records instead.
- **Snapshots:** order items and orders store the values that were true when the
  order was created; later catalog or settings changes do not rewrite history.

## 2. Enums

| Enum | Values |
|---|---|
| `Role` | `OWNER`, `WAITER`, `CHEF`, `CASHIER` |
| `RoomSessionStatus` | `OPEN`, `CLOSED` |
| `MeasurementUnit` | `PIECE`, `KG`, `LITER`, `PORTION`, `OTHER` |
| `ProductStatus` | `ACTIVE`, `DISABLED`, `ARCHIVED` |
| `OrderType` | `DINE_IN`, `DELIVERY` |
| `OrderStatus` | `PENDING`, `CONFIRMED`, `PREPARING`, `PARTIALLY_READY`, `READY`, `SERVED`, `COMPLETED`, `CANCELLED` |
| `OrderItemStatus` | `PENDING`, `PREPARING`, `READY`, `SERVED`, `CANCELLED` |
| `DeliveryStatus` | `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED` |
| `PaymentKind` | `CASH`, `CARD`, `OTHER` |
| `ServiceFeeMethod` | `PER_PERSON` |

Prisma enums are mirrored 1:1 in `packages/shared-types/src/enums.ts`.

## 3. Tables

### Users and access

**User** — staff account.
`id`, `username` (unique), `passwordHash` (argon2), `fullName`, `phone?`,
`role`, `isActive`, `canCreateDelivery`, timestamps.
Index: `(role, isActive)`.

**RefreshToken** — refresh-token rotation family.
`id`, `userId`, `tokenHash` (unique), `familyId`, `expiresAt`, `revokedAt?`,
`replacedById?`, `userAgent?`, `ip?`, `createdAt`.
Indexes: `userId`, `familyId`. Reuse of a rotated token revokes the family.

### Rooms

**Room** — physical room. `id`, `name` (unique), `isActive`, timestamps.

**RoomSession** — one visit/occupancy of a room.
`id`, `roomId`, `status`, `openedAt`, `closedAt?`,
cached money: `totalAmount`, `paidAmount` (integer UZS),
override: `closeOverrideReason?`, `closeOverrideById?`.
Indexes: `(roomId, status)`, `status`.

> "At most one OPEN session per room" is enforced by a row-level
> `SELECT … FOR UPDATE` lock on `Room` inside
> `RoomsService.getOrCreateOpenSession`. A `@@unique([roomId, status])` is
> intentionally **not** used because it would also forbid multiple CLOSED
> sessions for the same room.

### Catalog

**Category** — `id`, `name` (unique), `sortOrder`, timestamps.

**Product** — `id`, `name`, `categoryId`, `unit`, `price` (integer UZS per
unit), `status`, timestamps. Indexes: `(categoryId, status)`, `status`.
Product names are stored exactly as supplied (Uzbek Cyrillic where provided) and
must never be auto-translated.

**ProductImage** — 1:1 with Product. `fileName`, `thumbnailName?`, `mimeType`,
`sizeBytes`, timestamps. Deleting a product cascades its image row; the storage
service removes files.

### Orders

**Order** — `id`, `orderNumber` (unique sequential integer), `type`, `status`,
`roomId?`, `roomSessionId?`, `numberOfPeople`, `note?`.

Financial snapshots:
`itemsTotal`, `serviceFeeAmount`, `serviceFeePerPerson`, `serviceFeeMethod`,
`totalAmount`, `paidAmount` — all integer UZS.
Cancellation: `cancelReason?`, `cancelledAt?`.
Creator: `createdById`, timestamps.
Indexes: `(status, type)`, `roomSessionId`, `createdAt`, `roomId`.

**OrderItem** — `id`, `orderId`, `productId?` (nullable so a deleted product
does not destroy history), snapshots `productName`, `productUnit`,
`unitPrice`, `quantity` (Decimal 8,3), `lineTotal`, `status`, `note?`,
timestamps. Indexes: `orderId`, `status`.

**OrderStatusHistory** — append-only transition log.
`fromStatus?`, `toStatus`, `actorId?`, `note?`, `createdAt`.

### Delivery

**Delivery** — 1:1 with Order (`orderId` unique).
`customerName`, `customerPhone`, `address`, `status`, `assignedToId?`,
timestamps. Indexes: `status`, `assignedToId`.

### Payments

**PaymentMethod** — `id`, `name` (unique), `kind`, `isActive`. Seeded: Naqd
(`CASH`), Karta (`CARD`).

**Payment** — `id`, exactly one of `orderId?` / `roomSessionId?` in practice,
`amount` (integer UZS), `methodId`, `note?`, `idempotencyKey?` (unique),
`receivedById`, `reversedAt?`, `createdAt`.
Indexes: `orderId`, `roomSessionId`, `createdAt`.

**PaymentReversal** — 1:1 with Payment.
`reason`, `reversedById`, `reversedByName`, `createdAt`. Payment rows are never
deleted.

### Money out

**Expense** — `id`, `title`, `amount` (integer UZS), `category?`, `note?`,
`spentAt`, `createdById`, `createdAt`. Index: `spentAt`.

### Settings

**ServiceFeeConfig** — singleton row, `id = 'service_fee_config'`.
`enabled` (default true), `amountPerPerson` (default 4 000), `applyToDineIn`,
`applyToDelivery`, `method` (`PER_PERSON`), `updatedAt`.

### Notifications

**Notification** — `id`, `userId`, `type`, `title`, `body`, `data` (JSON),
`readAt?`, `createdAt`. Indexes: `(userId, readAt)`, `createdAt`.

**PushSubscription** — `id`, `userId`, `endpoint` (unique), `p256dh`, `auth`,
`createdAt`. Index: `userId`.

### Audit

**AuditLog** — `id`, `actorId?`, `actorName`, `action`, `entity`, `entityId?`,
`details` (JSON), `createdAt`. Indexes: `(entity, entityId)`, `createdAt`,
`actorId`.

Actions include `PRODUCT_PRICE_CHANGED`, `PAYMENT_RECEIVED`,
`PAYMENT_REVERSED`, `SESSION_CLOSE_OVERRIDE`, `ORDER_CANCELLED`, role/employee
changes, and settings updates.

## 4. Financial invariants

- `Order.itemsTotal = Σ OrderItem.lineTotal` (active items).
- `Order.serviceFeeAmount = numberOfPeople × serviceFeePerPerson` when the fee
  applies, evaluated and frozen at order creation.
- `Order.totalAmount = itemsTotal + serviceFeeAmount`.
- `Order.paidAmount = Σ non-reversed payments` attributed to the order.
- `RoomSession.totalAmount = Σ Order.totalAmount` for non-cancelled orders in
  the session.
- `RoomSession.paidAmount = Σ non-reversed payments` attributed to the session.
- Outstanding = `totalAmount − paidAmount`.
- Session close with outstanding > 0 is only possible via OWNER override, which
  writes an audit entry containing the reason.

Cached totals are recomputed inside the same transaction as the mutation that
changes them (payment, reversal, order edit, cancellation), so a crash cannot
leave a half-applied balance.

## 5. Generative rules

- `Order.orderNumber` is allocated inside a transaction as `max + 1` and is
  unique. It is the human-friendly number printed on receipts.
- Delivery status transitions are validated in `DeliveriesService`; arbitrary
  jumps are rejected.
- Item status transitions follow `PENDING → PREPARING → READY → SERVED`
  (`CANCELLED` is terminal).

## 6. Migrations

```
apps/api/prisma/migrations/
  20261109065541_init
  20261109074821_fix_room_session_unique
```

Apply in every environment:

```bash
npm run db:migrate        # prisma migrate deploy (safe for production)
npm run db:migrate:dev    # create a new migration during development
```

The schema is only evolved through migrations; never `prisma db push` in
production.

## 7. Seed data

`apps/api/scripts/seed.ts` (run with `npm run db:seed`) is idempotent.

Users (development credentials):

| Username | Password | Role |
|---|---|---|
| `owner` | `owner12345` | OWNER |
| `ofitsiant` | `password123` | WAITER |
| `oshpaz` | `password123` | CHEF |
| `kassir` | `password123` | CASHIER |

Rooms: 3 seeded rooms. Categories: Asosiy taomlar, Salat va qo‘shimchalar,
Non, Ichimliklar.

14 products with exact supplied names, units and integer prices:

| Product | Category | Unit | Price (UZS) |
|---|---|---|---|
| Оқ балиқ | Asosiy taomlar | KG | 45 000 |
| Сазан | Asosiy taomlar | KG | 70 000 |
| Табака | Asosiy taomlar | PIECE | 70 000 |
| Шўр карам | Salat va qo‘shimchalar | PORTION | 5 000 |
| Ёғли карам | Salat va qo‘shimchalar | PORTION | 5 000 |
| Сузма | Salat va qo‘shimchalar | PORTION | 5 000 |
| Нон | Non | PIECE | 4 000 |
| Нон яримта | Non | PIECE | 2 000 |
| Чой | Ichimliklar | PORTION | 3 000 |
| Pepsi 1L | Ichimliklar | LITER | 12 000 |
| Fanta 1L | Ichimliklar | LITER | 12 000 |
| Cola 1L | Ichimliklar | LITER | 12 000 |
| Flesh | Ichimliklar | LITER | 12 000 |
| Ҳамза сув | Ichimliklar | PIECE | 4 000 |

Payment methods: Naqd (CASH), Karta (CARD).
Service fee: enabled, 4 000 UZS/person, applied to dine-in and delivery.

## 8. Local database

Development and tests use `embedded-postgres` (real PostgreSQL binaries) on
port **5433**, data directory `.pgdata/` (gitignored). Locale is forced to
`C.UTF-8` so Cyrillic product names work in every environment.

- Dev database: `ikki_dost`
- Test database: `ikki_dost_test` (reset with `prisma migrate reset` by the test
  bootstrap)

Production uses a normal PostgreSQL server through `DATABASE_URL`.

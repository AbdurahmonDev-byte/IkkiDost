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

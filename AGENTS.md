# Ikki Do‘st Choyxonasi — Agent Guide

Complete business management ecosystem for the "Ikki Do‘st" teahouse.
One backend, one PostgreSQL database, multiple connected apps.

## Structure

```
apps/
  api/              NestJS + Prisma + PostgreSQL backend (REST + Socket.IO),
                    also serves the built Mini App and /uploads
  admin-web/        Next.js owner admin panel
  bot/              grammY Telegram bot (thin REST client, all roles)
  mini-app/         Telegram Mini App: Vite + React + Tailwind
                    (customer self-service + staff screens)
legacy/
  mobile/           Expo React Native app (superseded by bot + Mini App)
  chef-web/         Next.js kitchen app (superseded by Mini App)
  cashier-desktop/  Tauri 2 cashier app (superseded by Mini App)
packages/
  shared-types/     Shared TS types & enums (single source of truth for contracts)
  validation/       Shared Zod schemas
  utils/            Money (integer UZS), service fee calc, formatting
  api-client/       Typed API client shared by all frontends
  design-system/    Shared design tokens / Tailwind preset
docs/               Architecture, database, API, deployment, testing docs
```

## Commands (from repo root)

- `npm install` — install all workspace deps
- `npm run db:start` — start embedded dev PostgreSQL (no system install needed)
- `npm run db:migrate` — run Prisma migrations
- `npm run db:seed` — seed initial data (roles, owner, categories, products, service fee config)
- `npm run dev:api` / `dev:admin` / `dev:bot` / `dev:mini-app`
- `npm run test:api` — backend unit + integration tests
- `npm run typecheck` — typecheck all workspaces

## Non-negotiable rules

- ONE backend (`apps/api`), ONE PostgreSQL database. No per-app databases.
- Money is ALWAYS integer UZS (`Int` in Prisma). Never floating point for money.
- No hardcoded products or service fees in frontends — everything comes from the API/DB.
- Order items and payments store historical snapshots (product name, unit, price, fee).
- Backend enforces all role permissions (OWNER / WAITER / CHEF / CASHIER / DELIVERY) via guards — never rely on frontend hiding.
- Rooms only, no table management.
- Full and partial payments; a room session cannot close with an outstanding balance (owner override requires reason + audit log).
- Never commit secrets. Use `.env` (see `.env.example`).
- Uzbek Latin is the default UI language; keep supplied product names in their original spelling; never auto-translate product names.

## Conventions

- TypeScript strict mode everywhere.
- Shared contracts live in `packages/shared-types` and `packages/validation`; import from there instead of duplicating.
- Prisma schema is the source of truth for the DB; evolve it only via migrations (`prisma migrate dev`).
- API is prefixed with `/api`; Swagger at `/api/docs`.
- Real-time via authenticated Socket.IO namespace `/rt`.
- Update `PROJECT_STATUS.md` and `DECISIONS.md` after each completed phase.

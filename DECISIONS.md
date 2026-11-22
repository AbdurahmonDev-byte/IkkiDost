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
- **Decision:** `OrderItem` stores `productName`, `productUnit`, `unitPrice`, `unitCost`, `lineTotal` and `costTotal`. Orders store `serviceFeeAmount` snapshot + `serviceFeePerPerson` snapshot. Later product/setting changes never mutate historical records.
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
  - Staff do not send passwords in the bot; their role is resolved from the
    Telegram ID assigned by the owner.
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

## ADR-018: Telegram identity as the staff login
- **Context:** Staff move between phones and desktop machines and often forget
  passwords; typed passwords in chat are a security risk.
- **Decision:** The owner assigns each employee's Telegram ID in the employee
  manager. The Mini App sends signed `initData` to `POST /auth/telegram`; the
  API validates the HMAC with `BOT_TOKEN` and resolves the employee and role by
  the ID. The bot performs the same lookup through `POST /auth/telegram/bot`,
  protected by the `x-bot-secret` header. Non-owner employees cannot receive
  sessions through username/password login or self-link their Telegram ID.
  The Mini App owner tab and admin-web both support ID assignment.
  - The owner identity is resolved from the `OWNER_TELEGRAM_IDS` allowlist.
  - Every role, including OWNER, logs in without a password. (The original
    extra owner password was removed by ADR-025.)
  - `TELEGRAM_AUTH_MAX_AGE_SECONDS` (default 86 400) rejects stale payloads.
  - Usernames that later change in Telegram are refreshed on login.
- **Consequences:** Employees log in from any Telegram client with no shared
  passwords. The owner allowlist must be kept current; anyone who controls an
  allowlisted Telegram account acts as OWNER. Existing non-owner refresh
  sessions are revoked by migration
  `20261112180000_enforce_telegram_staff_login` during rollout.

## ADR-019: Dedicated DELIVERY role and customer → kitchen → courier flow
- **Context:** Remote orders need a responsible courier, but waiters and
  cashiers should not manage hand-offs from their own screens.
- **Decision:** Add `DELIVERY` to the shared and Prisma `Role` enums. Couriers
  see their assigned deliveries plus unassigned ones in `CONFIRMED`,
  `PREPARING` or `READY`, claim one (`POST /deliveries/:id/claim`), and may set
  only `OUT_FOR_DELIVERY` and `DELIVERED`. Kitchen readiness stays with CHEF /
  OWNER and automatically advances the delivery to `READY`. OWNER keeps full
  control (assign, override statuses).
- **Consequences:** The remote-order lifecycle is explicit and auditable
  (`DELIVERY_CLAIMED` audit entry); a courier cannot mark food ready or cook it.
  The same REST endpoints serve the bot and the Mini App.

## ADR-020: Mandatory customer registration and delivery-only remote orders
- **Context:** Anonymous phone orders cannot be attributed, contacted or shown
  a receipt later. On-site guests should not bypass the waiter by ordering from
  their own phone.
- **Decision:**
  - Customers register with first and last name; the Telegram contact-sharing
    button verifies the phone number (`request_contact`, `contact.user_id`
    checked against the Telegram identity). Registration is stored in the
    `Customer` table keyed by `telegramId`.
  - On first `/start`, the bot offers the Telegram profile name and surname for
    confirmation or lets the customer replace them before sharing a contact.
  - Remote ordering through `POST /public/orders` requires validated Telegram
    `initData` for a registered customer with a verified phone. Only delivery
    orders are accepted; dine-in orders must be created by staff.
  - Delivery checkout asks for the device location with explicit permission and
    stores a shareable map URL in the delivery address; manual address entry is
    still available.
  - On-site guests use `POST /public/call-waiter` with a room id instead.
  - Receipts and order tracking are scoped to the authenticated customer.
- **Consequences:** Every remote order has a real, contactable customer and an
  honest audit trail. Real SMS OTP is not required; verification depends on
  running inside Telegram.

## ADR-021: Printable receipts rendered client-side
- **Context:** Customers and cashiers need a receipt immediately, including on
  devices without a thermal printer driver.
- **Decision:** `ReceiptModal` renders an 80 mm-style receipt from the existing
  order DTO (order number, date, type, items, service fee, total, paid, debt,
  delivery details) and calls `window.print()`. Dedicated `@media print` CSS
  hides the app chrome so only the receipt prints. No new receipt endpoint or
  duplicated totals are introduced; historical snapshots come from the order.
- **Consequences:** Works on any device/browser, including the Telegram in-app
  browser, and stays consistent with the cashier desktop receipt format.

## ADR-022: Delivery location capture and saved customer address
- **Context:** Customers repeatedly type the same address, and Telegram already
  exposes a reliable location picker. Couriers also need an actionable
  destination on the first attempt.
- **Decision:**
  - `Customer.deliveryAddress` stores the latest address as free text or a
    Google Maps link (`https://maps.google.com/?q=<lat>,<lng>`).
  - Bot `/start` and the registration completion immediately ask for a
    delivery location with a Telegram `request_location` reply keyboard, a
    manual-text fallback and a skip option. The same prompt is reachable from
    the customer menu (“📍 Manzilni o‘zgartirish”).
  - The bot saves the result through the bot-only
    `PATCH /public/customers/bot` route.
  - The Mini App prefills the cart address from `Customer.deliveryAddress`
    (falling back to the last address in `localStorage`) and can append a
    Google Maps URL from the browser/Telegram geolocation.
  - `POST /public/orders` persists the submitted address back to the profile.
  - Staff creating a delivery in the bot use the same location-or-text prompt.
- **Consequences:** One address field serves bot, Mini App and courier; no
  separate address book table is needed yet. Customers can always override the
  prefilled value per order.

## ADR-023: Courier cash collection and cashier handover
- **Context:** Remote orders are usually paid in cash at the door. Without an
  explicit reconciliation step, courier cash and order balances can drift.
- **Decision:**
  - `Delivery` gains `cashCollectedAmount`, `cashCollectedAt` and
    `cashHandedOverAt`.
  - When a courier (or owner) sets `DELIVERED`, they record the cash collected
    (default: outstanding amount, capped at it; `0` = card/no cash). The order
    balance is *not* changed at this point.
  - The cashier or owner confirms receipt with
    `POST /deliveries/:id/handover` (“To‘lov qilindi”). This records a normal
    CASH payment (idempotency key `delivery-cash-<deliveryId>`), sets
    `cashHandedOverAt`, writes `DELIVERY_CASH_HANDED_OVER` and notifies the
    courier.
  - Both the bot and the Mini App expose the courier cash prompt and a cashier
    “Kassa” screen listing pending handovers. Marking `DELIVERED` with cash
    notifies CASHIER and OWNER.
  - Handover is rejected when there is no recorded cash or it was already
    confirmed, so retries cannot double-book revenue.
- **Consequences:** Cash is visible as “in courier's hands” without inflating
  paid revenue; the existing payments/audit pipeline remains the single source
  of truth once the cashier confirms. This also makes courier shortages
  immediately visible as a delivery with cash recorded but not handed over.

## ADR-024: Owner-managed roles, activation and employee lifecycle
- **Context:** Staff turnover is frequent, and the owner should not need shell
  or SQL access to replace a courier or promote a waiter.
- **Decision:** `PATCH /employees/:id` accepts `role`, `isActive`, name/phone
  and a new `telegramId`. The Mini App owner tab exposes a role selector and an
  activate/deactivate toggle per employee; admin-web keeps the full employee
  form. Guards prevent deactivating the last active OWNER and reserve the
  owner's Telegram ID.
- **Consequences:** Role changes apply on the employee's next access-token
  refresh (access tokens live 15 minutes) or next login, because the role is
  carried in the JWT. Deactivation blocks token refresh immediately and
  therefore takes full effect within one access-token lifetime. Historical
  orders, payments and audit entries keep the original actor references.

## ADR-025: Passwordless owner login and customer-first owner screen
- **Context:** The owner asked to enter the Mini App like any other staff member
  and to see the normal customer screen first, opening the owner panel only when
  the “Ega” tab is pressed. The extra owner password added friction (and a
  second password prompt in an already Telegram-authenticated session) without
  meaningful protection, because the owner identity is already verified by
  Telegram.
- **Decision:**
  - `POST /auth/telegram` and `POST /auth/telegram/bot` no longer accept or
    require a password. OWNER is resolved from the `OWNER_TELEGRAM_IDS`
    allowlist and receives the same passwordless flow as every other role.
  - `OWNER_PASSWORD_REQUIRED` / `OWNER_PASSWORD_INVALID` are removed from the
    API contracts, bot flows and the Mini App login modal.
  - The Mini App opens on the `customer` tab after any staff auto-login,
    including OWNER. The owner panel is reached only through the “Ega” tab.
- **Consequences:** One consistent login path for every employee. Security now
  depends on Telegram account control plus the owner allowlist; removing a
  Telegram ID from `OWNER_TELEGRAM_IDS` immediately blocks passwordless owner
  login (existing access tokens expire within 15 minutes). The admin-web login
  and the seeded owner password remain only as the owner bootstrap/recovery
  path.

## ADR-026: Cashier admin access, cost snapshots and payment receipts
- **Context:** The cashier needs the room/catalog and management tools available to the owner, product-level cost visibility for net profit, and a receipt beside recorded payments.
- **Decision:** CASHIER receives the OWNER-protected admin/API capabilities and may sign in to admin-web with a password configured by the owner; WAITER, CHEF and DELIVERY retain Telegram-only staff login. Products store integer UZS `costPrice`; each order item snapshots `unitCost` and `costTotal`, and reports subtract cost of goods and expenses from paid revenue. The Mini App cashier workspace includes all orders, rooms, menu editing, payments and courier cash handover; order receipts use the shared 80 mm print view.
- **Consequences:** Existing products and order items migrate with cost 0, so historical profit will not include costs unless backfilled. Changing a product's cost only affects future order items. Cashier room closure with debt still requires an audited reason.

## ADR-027: Customer menu photography and dark editorial theme
- **Context:** The Mini App customer menu needed a more visual restaurant presentation and the seeded products had no uploaded photos.
- **Decision:** Use a dark, editorial food-menu theme with a featured dish, gold accents and compact dish tiles. Bundle locally stored photos keyed by the exact seeded product names; user-uploaded product images remain higher priority. Commons image credits and licenses are listed in `apps/mini-app/public/menu/ATTRIBUTION.md`; Unsplash images use the Unsplash License. No alternate-brand image is assigned to Flesh because no reusable exact-match photo was found.
- **Consequences:** The customer menu works without remote image hotlinks; newly added products can still use their uploaded image or the neutral fallback until a matching photo is assigned.

## ADR-028: Dark-only Mini App
- **Context:** The Mini App is used as a restaurant floor/kitchen tool and a dark-only interface is preferred; a light theme is not used.
- **Decision:** Tailwind uses `darkMode: 'class'`; `.dark` is present on `<html>` in `index.html` and `applyTheme()` enforces it before first paint. There is no light-theme toggle or system-preference switching. Shared surfaces and controls use dark colors; screens use dark-compatible utility classes. Printable receipt paper remains white only in print output for legibility.
- **Consequences:** All new Mini App screens must be authored and checked in dark mode. Telegram header/background colors are set to matching dark surfaces where supported.

## ADR-029: Finance charts in cashier overview
- **Context:** Cashiers need to monitor daily money movement, not only individual payment records.
- **Decision:** The cashier overview reuses `WeeklyFinanceChart` to display seven-day revenue, expenses, and profit; its totals and tooltips use the same report API values as the owner dashboard. Today's expenses and product cost remain visible as separate metrics.
- **Consequences:** Owner and cashier see the same finance definitions; profit remains revenue minus expenses and sold-item cost.


## ADR-030: Staff-only ordering and Telegram bot
- **Context:** Customers should not order delivery or call waiters from Telegram; orders are taken by staff at the room or by phone.
- **Decision:** The Telegram bot only serves staff (Telegram ID login). Non-staff IDs receive a staff-only message. The Mini App order screen is available to OWNER, WAITER and CASHIER; CASHIER can start an order from the cashier workspace. The API no longer exposes `POST /public/orders` or `POST /public/call-waiter`. Quantities are decimal (up to 3 places) so kg/liter items can be entered exactly, e.g. `1.82`.
- **Consequences:** Customer registration endpoints still exist but are unused by the apps. Delivery orders are created by staff with the customer's name, phone and address. Old customer orders remain in the database.

## ADR-031: Windows cashier order entry and Saboy section
- **Context:** The cashier works from the desktop app but could only take payments. Customers calling from home need their orders recorded by the cashier.
- **Decision:** The desktop cashier can create orders for a room (DINE_IN) and for phone/home orders (DELIVERY, «Saboy»). The Saboy tab lists today's and still-unpaid delivery orders. The composer uses the same products, categories, service fee and decimal quantities (3 places) as the Mini App; the API and database are shared by bot, Mini App and desktop.
- **Consequences:** Desktop and Mini App always show the same rooms, orders and payments. The desktop is still built for Windows through GitHub Actions; printing uses the WebView print dialog.

## ADR-032: Payments in the Telegram bot and courier cash in the desktop cashier
- **Context:** The cashier needs to accept money away from the desk, and the desktop app could not confirm courier cash handovers that the bot and Mini App already supported.
- **Decision:** The bot gets a payment screen for OWNER/CASHIER (full amount per method or typed partial amount) using the existing `/payments/session/:id` and `/payments/order/:id` endpoints. CASHIER has the same bot rights as in the API (orders, deliveries, dashboard, debt close with reason). The desktop cashier adds a «Kuryer» tab using `POST /deliveries/:id/handover` (new `ApiClient.handoverDeliveryCash`) and daily payment totals.
- **Consequences:** No API or schema change. Money still flows only through the audited payments pipeline; overpayment is rejected server-side, so repeated bot taps cannot double-charge. Desktop version is 0.2.0 so the MSI upgrades the 0.1.0 install.

## ADR-033: Login-free desktop cashier (kiosk) with a POS-style screen
- **Context:** The cashiers are used to a till program that opens straight to the sales screen without a login, with room tiles, a product grid and a numeric keypad. They asked to remove the login/password and the courier section from the Windows app.
- **Decision:** `POST /auth/kiosk` issues tokens for the dedicated CASHIER account `kassa` without credentials when `CASHIER_KIOSK=on`. An optional `CASHIER_KIOSK_KEY` must match the `x-kiosk-key` header; the Windows build embeds it from the GitHub secret. The desktop app has no login screen and reconnects by itself. The UI is rebuilt as a POS: room tiles → menu grid + ticket, keypad payment with change, saboy tiles, and a «Bugun» payments screen.
- **Consequences:** The owner explicitly accepted that the terminal needs no credentials. Anyone holding a copy of the exe (or, without a key, anyone who can reach the API with the kiosk switched on) can act as the cashier, including CASHIER admin capabilities from ADR-026. Mitigations: the switch is off by default, the key blocks random internet callers, all actions are attributed to «Kassa» in payments/audit, and deactivating that employee disables the terminal immediately (refresh is refused, access tokens expire within 15 minutes).

## ADR-034: Bot follows the desktop POS flow
- **Context:** Staff asked for the bot to work like the desktop till (Zal → room ticket → add items → pay with change → close).
- **Decision:** Bot menus and wording mirror the desktop (Zal / Saboy / Bugungi kassa). Adding items to an open room bill appends to its latest open order instead of creating a new order, so no extra service fee or people prompt. Cash entered above the balance is treated as money handed over: the balance is charged and the change is shown; non-cash amounts above the balance are rejected.
- **Consequences:** Same business rules as the desktop; no API change. A chef note typed while appending is stored on the appended items (the order-level note is fixed at creation).

## ADR-035: Till-first operation — no kitchen screen, take-away saboy
- **Context:** Staff found the system too elaborate. The kitchen is told orders verbally; the software is used to control the till. Saboy orders are take-away, not delivered.
- **Decision:** The desktop cashier follows the till layout staff already know (room tiles → ticket + keypad + photo grid → full-screen payment with change). Delivery customer fields are optional in the API with defaults; a full payment completes a saboy order. The CHEF role is no longer offered (enum kept; existing accounts are not deleted).
- **Consequences:** Kitchen statuses are no longer meaningful; dine-in orders complete on full payment as before. Courier/handover features remain in the API but are hidden from the main flows.

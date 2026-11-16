# Climo — React + Node.js saree marketplace

A runnable TypeScript monorepo with three React applications, an Express API, PostgreSQL/Prisma persistence and a background worker. Built from the approved Climo architecture.

**Release status: development implementation, not the complete production-ready scope in the master prompt.** The implemented core is connected to real database operations. Several advanced modules and provider integrations remain incomplete; see [the feature matrix](docs/feature-status.md). No mock payment success, automatic admin refund execution, or disconnected dashboard totals are used.

## Applications

| Application                     | Local URL             | Entry                |
| ------------------------------- | --------------------- | -------------------- |
| Customer storefront             | http://localhost:5173 | `apps/customer-web`  |
| Seller portal                   | http://localhost:5174 | `apps/seller-portal` |
| Admin / Finance portal          | http://localhost:5175 | `apps/admin-portal`  |
| Node API                        | http://localhost:4000 | `apps/api`           |
| Reservation / settlement worker | Background process    | `apps/worker`        |

Features include public product discovery, product details, cart, saved addresses, wishlist, server quotes, multi-seller orders, approval and price requests, inventory audit, seller suspension, banners/CMS/coupons, signed payment handling, fulfillment, cancellation, return/exchange requests, Finance-only refund authorization, settlement preparation, stock request routing, support, reviews/Q&A and audit history. The catalog finder is deterministic database search, **not an AI chatbot**.

## Quick start

Install Node.js 24 and npm, then extract the project ZIP. Open a terminal in the folder containing `package.json`.

You do not need a separate PostgreSQL installation when embedded database mode is supported on your platform. Windows execution has not been verified in the authoring environment.

### Windows Command Prompt (CMD)

Use this version when your prompt looks like `C:\Users\ABHI\...>` without a `PS` prefix. Run each command separately and wait for it to finish:

```cmd
npm ci
copy .env.example .env
set "CLIMO_EMBEDDED_DB=true"
set "SEED_PASSWORD=ClimoLocal2026!"
npm run db:generate
npm run dev
```

If `npm ci` and `npm run db:generate` have already succeeded, you can skip repeating them. Copy `.env.example` only for initial setup: do not overwrite an existing customized `.env`.

### Windows PowerShell

Use this version when your prompt starts with `PS`:

```powershell
npm ci
Copy-Item .env.example .env
$env:CLIMO_EMBEDDED_DB="true"
$env:SEED_PASSWORD="ClimoLocal2026!"
npm run db:generate
npm run dev
```

### macOS / Linux

```sh
npm ci
cp .env.example .env
export CLIMO_EMBEDDED_DB=true
export SEED_PASSWORD='ClimoLocal2026!'
npm run db:generate
npm run dev
```

`ClimoLocal2026!` is an example password for local demo accounts only. Choose your own password of at least 12 characters when first seeding. Keep the terminal running while using the website.

The environment-variable commands above apply to the current terminal session. For subsequent launches, either repeat the two variable commands or save these values in your local `.env` file:

```dotenv
CLIMO_EMBEDDED_DB=true
SEED_PASSWORD=your-chosen-local-password
```

Then start the project with `npm run dev`.

The development launcher starts a **local PostgreSQL database**, applies migrations, seeds development data when `SEED_PASSWORD` is set, starts the API and worker, and runs all three portals. It stores development data in `.dev-postgres/`, excluded from Git and distribution archives. This mode uses local-only credentials and is explicitly rejected in production. Stop with Ctrl+C. If port 5432 is already used, use your own PostgreSQL instance instead.

On supported platforms the embedded-postgres dependency supplies a development PostgreSQL binary. If your platform cannot run it, use Docker or an existing PostgreSQL server.

### Existing PostgreSQL / Docker

```sh
docker compose up -d postgres redis
```

Keep `CLIMO_EMBEDDED_DB=false`, set `DATABASE_URL` for that server, then run:

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The seed is disabled for `NODE_ENV=production` and refuses to use an absent or short password. Re-running the seed is idempotent and does not overwrite account passwords. Sample product SVGs are original illustrative textile studies, not supplier photographs or authenticated product representations. Replace sample products, policies and media before launch.

### Development accounts

All four accounts use the password you selected in `SEED_PASSWORD`:

| Email                | Role        | Portal |
| -------------------- | ----------- | ------ |
| customer@climo.local | Customer    | 5173   |
| seller@climo.local   | Seller      | 5174   |
| admin@climo.local    | Super Admin | 5175   |
| finance@climo.local  | Finance     | 5175   |

A role is attached to an authenticated server session. Changing a URL or UI state cannot grant a different role. Portals share the same cookie on localhost, so signing into another role replaces the active local session. Use separate browser profiles to operate multiple roles simultaneously.

## Common setup issues

| Message or symptom | What to do |
|---|---|
| `Copy-Item is not recognized` | You are in CMD. Use `copy .env.example .env`. |
| `$env:...` produces a filename syntax error | You are in CMD. Use `set "NAME=value"`. |
| `prisma is not recognized` | Let `npm ci` finish successfully, then rerun `npm run db:generate`. |
| `^C` appears during installation | Installation was interrupted. Run `npm ci` again and wait for completion. |
| Password does not change after reseeding | Seeding preserves existing accounts. Use the password selected during the first successful seed. |
| Port 5432 is already in use | Stop the conflicting local service if appropriate, or configure an existing PostgreSQL server with embedded mode disabled. |
| Embedded database startup fails | Copy the complete startup error for diagnosis. Platform compatibility and local restrictions may require a PostgreSQL or Docker fallback. |

The app has not been published online. Local URLs work on the computer running the application.

## Verify

```sh
npm run typecheck
npm test
npm run test:integration
npm run build
```

`test:integration` creates and destroys its own temporary real PostgreSQL database on port 55432. It applies actual migrations and tests API behavior with Supertest. No external payment requests are made. See [verification evidence](docs/verification.md) for the checks run in the authoring environment and their limits.

The three independent build outputs are `apps/customer-web/dist`, `apps/seller-portal/dist`, and `apps/admin-portal/dist`. Build output, dependencies, runtime data and secrets are not included in the source ZIP.

## Provider configuration

Set environment variables on your server, never in frontend code or Git. Do not paste production secrets into a chat.

- Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Configure automatic capture at the gateway. Subscribe to `payment.captured` at `/api/v1/webhooks/razorpay`. Raw-body HMAC verification, amount/currency checks and event deduplication are implemented. A failed or uncertain provider request is not silently retried under a new key.
- Refunds: Finance must authorize first. `FINANCE_EXECUTION_ENABLED=true` is an explicit deployment control **only after sandbox verification**. Refund POST timeouts stay `PROCESSING`; reconcile authoritative provider records instead of blindly resubmitting.
- Payout provider, shipping provider, S3 media uploads, SMTP delivery, AI provider and Redis-backed jobs/rate limits are **not fully integrated** in this release. Their environment placeholders do not imply functionality. Payout execution returns a clear 503 and never claims money was sent.
- Tax: downloaded PDFs are order receipts, **not GST tax invoices**. Tax policy, seller legal snapshots, fiscal numbering, credit notes and applicable marketplace deductions require implementation and qualified business review before real trading.

## Security boundaries

Super Admin reviews operational eligibility and sees financial records but cannot execute refunds or payouts, edit gateway facts, or self-assign Finance. Privileged accounts are created through an independent deployment operator:

```sh
# Set PROVISION_EMAIL, PROVISION_NAME, PROVISION_ROLE (ADMIN or FINANCE),
# and PROVISION_PASSWORD in a secure local shell environment, then:
npm run provision
```

`PROVISION_PASSWORD` must be at least 16 characters. Clear these environment variables after provisioning. There is no HTTP Finance-provisioning endpoint.

Stock and coupon reservations use serializable PostgreSQL transactions with retry. Database constraints enforce nonnegative stock and usage limits. Payment events and checkout keys are unique. Financial ledger and audit rows are protected by append-only database triggers. Cookie sessions are hashed at rest, revocable, HttpOnly, SameSite=Lax and Secure in production; state-changing browser requests require an allowed Origin and a session CSRF token. Passwords use bcrypt. All business errors use `{code,message,requestId}`; unexpected server errors do not expose stack traces.

This does not replace a security review. Production still needs privileged-user MFA/re-authentication, durable distributed rate limiting, email verification/reset, secure document upload, retention enforcement, backup/restore validation, monitoring and the other items in the feature matrix.

## Repository layout

- `apps/api/src`: auth/security, catalog, commerce and operational services.
- `apps/worker/src`: expiry cleanup and weekly settlement preparation.
- `apps/*-web`, `apps/*-portal`: independently buildable React entry points.
- `packages/ui/src`: shared storefront/workspace pages and responsive styling.
- `packages/domain/src`: money allocation, pricing and state-machine rules.
- `packages/database`: Prisma schema, SQL migrations and development seed.
- `tests`: pricing/signature tests and real-PostgreSQL integration scenarios.
- `infra`: reference Docker deployment assets.
- `docs`: approved architecture, API inventory, verification and outstanding work.

## GitHub

Repository: https://github.com/abhignanvemu2/climo-marketplace

Clone the source:

```sh
git clone https://github.com/abhignanvemu2/climo-marketplace.git
cd climo-marketplace
```

Follow the setup instructions above. Local `.env` files, runtime databases and installed dependencies are excluded from Git. See `docs/feature-status.md` for implemented features and remaining production work.

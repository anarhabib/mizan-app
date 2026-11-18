# Mizan project state

## Current status

- Tasks 1–11 are on `main`. Task 11 merged in PR #7 (`c0db717`).
- `apps/web` provides owner registration, sign-in, and workspace selection at `/register` and `/workspace`. Azerbaijani is the default and English can be selected. Translations live in `apps/web/features/language/messages.ts`; the browser remembers the selected language.
- `packages/contracts` provides exact decimal input, currency precision, and half-up settlement rounding. `packages/database/prisma/schema.prisma` defines the private `mizan` schema. The initial Prisma migration applied to local Supabase PostgreSQL.
- `apps/api/src/plugins/auth.ts` verifies Supabase-issued tokens through JWKS or Supabase Auth's user endpoint for legacy signing. `apps/api/src/plugins/request-context.ts` attaches context only after verifying current membership and store assignment in PostgreSQL. Access errors do not expose whether an unauthorized scope exists.
- `apps/api/src/modules/onboarding` provides `POST /api/v1/onboarding` and `GET /api/v1/me/contexts`. The additive `202611180001_owner_onboarding` migration records one initial workspace per authenticated identity. A transaction locks that identity while creating the organization, first store, owner assignment, and defaults.
- 41 automated tests passed against disposable localhost PostgreSQL, including concurrent onboarding, invitation acceptance, and revoked access. Build, lint, type checks, and format checks passed.
- A headless browser verified registration against a real disposable Supabase Auth instance, first-store creation, sign-out, sign-in, and language selection at mobile and desktop widths. Email confirmation was disabled for the test; the email confirmation link flow remains to be exercised.
- `apps/api/src/modules/memberships` implements invites and owner access changes. `/settings/users` and `/invitations/[token]` support both locales. The `202611180002_invitation_acceptor` migration links each accepted invitation to the salesperson's organization membership.
- Invitation links are single-use, expire after 48 hours, and store a digest. Invite email uses SMTP/Mailpit so both new and existing Supabase accounts can accept. A browser smoke test followed Mailpit links for both account types against disposable Supabase Auth and PostgreSQL.
- The workspace checks used a temporary Node.js 24 runtime because the installed Node.js 22.11 is below the workspace minimum.
- Supabase Studio, Mailpit, and Auth responded during smoke testing. Docker Desktop published the ports on all interfaces even with a loopback-configured bridge network. The development PostgreSQL data is retained when stopping the stack.

## Execution decisions

- Frontend work uses UI UX Pro Max alongside `DESIGN.md`. The workflow and upstream source are in `AGENTS.md`. Local installation is pending, and the published guidance is available through GitHub.

- Start each new task from `main` on its own branch. Once verified, commit and push the branch and open a PR into `main`. Merging requires separate approval.
- Prisma owns the application schema and migrations. The private `mizan` schema stays outside the Supabase Data API's exposed schemas.
- Folders, files, and routes use English names. Language affects interface copy, and business names and defaults remain independent.

## Approved foundation

- Next.js web app, Fastify API, Prisma, and local Supabase services in a pnpm monorepo.
- SaaS-ready organization/store scoping with Owner and Salesperson roles.
- Email invitations, configurable permissions/purities/rates, multi-currency sales, old-gold trade-ins, and cash payouts are in the first milestone.
- Zümrüd is the only initial palette.

## Important documents

- Design: `docs/superpowers/specs/2026-11-17-mizan-first-milestone-design.md`
- Plan: `docs/superpowers/plans/2026-11-17-mizan-first-milestone.md`
- Product context: `PROJECT_CONTEXT.md`
- Visual system: `DESIGN.md`

## Tasks 6–7

- Task 6 added owner-only trading settings at `/settings`, including acquisition-cost visibility, purity management, and append-only purchase rates.
- Task 7 adds the Tailwind Zümrüd tokens in `apps/web/app/globals.css`, the shared brand and controls in `apps/web/components`, and the authenticated layout in `apps/web/app/(app)/layout.tsx`. Navigation exposes workspace and the shipped owner settings pages. Store selection and authorization continue to use API-validated contexts.
- `apps/web/app/(auth)/sign-in/page.tsx` uses the existing Supabase password flow and adds localized validation feedback and password visibility. Browser checks use local Auth and API fixtures. Live sign-in and settings mutations were outside those checks.
- Task 7 passed 10 web tests, lint, web type checking, the production web build, and formatting for changed web files. The browser checks covered workspace and settings at 320, 375, 430, 768, 1024, and 1440 px, including mobile scroll compaction, Escape dismissal, and focus restoration. Repository-wide formatting still flags 19 pre-existing files.

## Task 8

- `apps/api/src/modules/products` implements product creation, inventory lookup and detail, plus signed photo upload and confirmation. `packages/contracts/src/products.ts` defines the inputs and responses. Every product route accepts `organizationId` and `storeId` in its query and checks the caller's assignment.
- Product creation records the opening movement in the same transaction and enforces organization-wide code uniqueness. Inventory lists return up to 50 items ordered by code. Use `q` for code/name search, `status` for availability, and the returned `nextCursor` as `after` to continue. Detail and creation responses show acquisition cost only to authorized users.
- Migration `202611180003_product_photo_metadata` adds content type and size to the existing object key. The photo upload route returns `uploadUrl` and `uploadId`. Send the file with PUT and its image content type, then POST `{ uploadId }` to confirm it. Each attempt gets a new scoped key, and confirming the same successful attempt again is safe. For local photos, provision the private bucket and configure the optional API credential as described in `README.md`.
- Acquisition costs accept an explicitly selected supported currency with ISO minor-unit validation so the form can use the organization's configured default.
- Workspace build, type checks, lint, Prisma validation, and formatting for the changed TypeScript files passed. All 50 tests passed, including disposable PostgreSQL integration and real local Supabase Storage. Unconfirmed uploads can remain in the private bucket.

## Task 9

- `apps/web/app/(app)/products` and `apps/web/features/products` provide localized product creation, store-scoped inventory search and pagination, product detail and movement history, and optional photo confirmation. The form preserves rejected values and submits decimal strings through the authenticated client in `apps/web/lib/api-client.ts`.
- `GET /api/v1/products/options` gives assigned owners and salespeople the store organization's default currency and active purity grades. The detail view only renders acquisition cost when the API includes it. The existing photo API accepts one confirmed photo per product.
- The production web build, TypeScript checks, ESLint, 14 web tests, and 15 API tests against disposable PostgreSQL passed. Browser checks with local fixtures covered the workflow as owner and salesperson at 320 and 1440 px, including photo confirmation and refresh for the owner. The live Supabase Storage check was skipped in this run.

## Next step

Task 12 covers end-to-end milestone verification, backup, and handoff after the Task 11 design alignment.

## Task 10

- `apps/api/src/modules/sales` provides scoped sale creation and retrieval, plus `GET /api/v1/sales/options` for the default currency and current trade-in rates. `packages/contracts/src/sales.ts` defines the request and response. Creation requires `Idempotency-Key` and records the sale, stock status, and inventory movements in one transaction.
- Prices and trade-ins use the organization's default currency. The store retains original cash and gives change in the default currency. A submitted foreign payment must cover the rounded balance. A negative balance is paid out in the default currency. Migration `202611180004_sale_payment` adds cash tender and change snapshots to `Sale`.
- Prisma migration and validation, the API and contracts builds, API type checking, and workspace lint passed. The API suite passed 19 tests on disposable PostgreSQL, including concurrent requests, rollback on invalid settlement, and immutable sale snapshots. The optional live Supabase Storage test was skipped.

## Task 11

- `apps/web/app/(app)/sales/new` and `apps/web/features/sales` provide Azerbaijani and English sale entry, in-stock lookup and inventory prefill, optional old-gold lines and overrides, cash tender and change, and confirmation. The result at `/sales/[id]` reloads the persisted sale, and sold product details link to it.
- The preview calculates with decimal strings and integer arithmetic. An uncertain submission retains the same payload and idempotency key while the confirmation is closed or retried. The optional `expectedCurrency` field rejects a stale default currency before inventory changes and accepts an exact retry against the saved currency.
- The contracts and API builds, web production build with TypeScript checks, workspace lint, and formatting for changed sources passed. The web suite passed 18 tests and the API suite passed 19 tests against disposable PostgreSQL. The optional live Storage test was skipped. Browser checks used local fixtures at 320 and 1440 px for ordinary sales, foreign cash with a trade-in, cash payouts, unavailable prefill, retry, and result reload.

## Task 11 design alignment

- `apps/web/components/shell`, the Products table, the New Sale work area, and the new Sales history route follow the owner's screenshot layout and live prototype. The Products table filters by store-scoped category, purity, and stock status. The Sales table uses recorded snapshots and supports reference/product search, Baku business dates, and pagination through `GET /api/v1/sales`.
- Sales history exposes the recorded seller ID and completed status. Inventory list rows use a product icon, with uploaded photos available from product detail. Demo prices, customer and payment selectors, and returns remain outside the current workflow.
- `AGENTS.md` now requires comparing rendered UI against the reference at desktop and mobile widths before opening future UI PRs.
- Verification covered 18 web tests, 19 API tests on disposable PostgreSQL, production builds, lint, and browser fixtures at 320 and 1890 px. The optional live Storage test was skipped.

## Workflow efficiency

- AGENTS.md now prefers inline execution of approved milestone tasks, contextual reuse of unchanged material, focused iteration checks, and full relevant verification before completion. UI work checks the exact approved reference and existing components first.
- Mandatory Superpowers planning, fresh-read, and review requirements remain applicable. The milestone plan and approved design remain the scope authorities. No execution-mode configuration change was needed.

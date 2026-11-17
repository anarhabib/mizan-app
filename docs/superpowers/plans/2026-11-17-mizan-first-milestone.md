# Mizan First Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a locally runnable, SaaS-ready Mizan vertical slice covering owner onboarding, salesperson invitation, tenant-safe inventory, and transaction-safe ordinary and old-gold sales.

**Architecture:** A pnpm monorepo contains a Next.js web application, a Fastify modular API, Prisma database package, and shared TypeBox contracts. Local Supabase supplies PostgreSQL, Auth, Storage, and captured development email; Fastify is the only business-data API and validates Supabase JWTs plus current organization/store access on every protected request.

**Tech Stack:** Node.js LTS, pnpm workspaces, TypeScript, Next.js App Router, Fastify, TypeBox, Prisma, Supabase local development, PostgreSQL, Vitest, Playwright, Docker.

**Spec:** `docs/superpowers/specs/2026-11-17-mizan-first-milestone-design.md`

## Global Constraints

- User-facing copy is localized in Azerbaijani (default) and English. Folder names, file names, and route paths use English. Business dates use `Asia/Baku`.
- Default UI uses only the Zümrüd palette from `DESIGN.md`, with semantic tokens.
- Every organization-owned query is tenant-scoped; store data also requires a current store assignment.
- Core inventory and financial writes go through Fastify, never directly from the browser to Supabase tables.
- Store weights as exact decimals with 3 fractional digits; per-gram rates with 4; exchange rates with 8.
- User-entered money follows ISO 4217 minor-unit precision; settlement rounds half-up only at the final total.
- Preserve immutable transaction currency, manual exchange rate, default-currency equivalents, trade-in calculation, accepted override, actor, and timestamps.
- Do not add billing, subscriptions, selectable themes, returns, reports, catalog, barcode, or camera scope.
- Never reset the database, delete history, or run destructive migrations without explicit approval.
- Tasks 1–5 form the initial `main` baseline. Start each subsequent task on a separate branch from current `main`; after verification, commit the task, push its branch, and open a PR. Keep unrelated changes out of the PR and get separate approval before merging.

## Review Focus

- Cross-tenant identifiers: tests must prove a valid user cannot read or mutate another organization or store by changing IDs.
- Stale authorization: tests must prove deactivation or store removal blocks the next API request despite a valid JWT.
- Decimal boundaries: tests must cover maximum allowed fractional digits, half-unit rounding, negative values, and unsupported currency precision.
- Concurrent sale submission: tests must prove two keys cannot sell one item twice and one key returns the original result.
- Partial external-service failure: tests must prove onboarding/invitation retries do not duplicate application records after Auth/email interruptions.

---

### Task 1: Local monorepo and service health

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `apps/web/**` from a minimal Next.js TypeScript App Router scaffold
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/modules/health/health.routes.ts`
- Create: `apps/api/test/health.test.ts`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/database/package.json`
- Create: `packages/database/src/index.ts`
- Create: `supabase/config.toml` and generated local Supabase support files
- Create: `README.md`

**Interfaces:**
- Produces: `buildApp(options?: BuildAppOptions): Promise<FastifyInstance>`; `GET /api/v1/health -> { status: "ok" }`; workspace scripts `dev`, `build`, `lint`, `typecheck`, `test`.

- [ ] **Step 1: Initialize Git and create the pnpm workspace with pinned Node/pnpm engines, TypeScript strict mode, formatting, and lint configuration.**
- [ ] **Step 2: Scaffold the minimal Next.js app, Fastify app factory, contracts package, and database package without feature code.**
- [ ] **Step 3: Initialize local Supabase configuration and document Docker-backed startup and captured-email URLs in `README.md`.**
- [ ] **Step 4: Write `health.test.ts` asserting status 200 and `{ status: "ok" }` from `GET /api/v1/health`.**
- [ ] **Step 5: Run `pnpm --filter @mizan/api test -- health.test.ts`; expect the test to fail before the route exists.**
- [ ] **Step 6: Implement `buildApp` and the health route, keeping network listening only in `server.ts`.**
- [ ] **Step 7: Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`; expect all checks to pass.**
- [ ] **Step 8: Start Supabase, API, and web locally; verify Studio/email capture, health JSON, and the Next.js start page.**
- [ ] **Step 9: Commit with `chore: initialize Mizan workspace`.**

### Task 2: Exact-value primitives and tenant database schema

**Files:**
- Create: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_initial_schema/migration.sql`
- Create: `packages/database/src/client.ts`
- Create: `packages/contracts/src/money.ts`
- Create: `packages/contracts/src/decimal.ts`
- Test: `packages/contracts/test/decimal.test.ts`
- Test: `packages/database/test/schema.integration.test.ts`

**Interfaces:**
- Produces: `MoneyInput { amount: string; currency: string }`; `parseDecimal(input, scale): DecimalString`; `roundMoneyHalfUp(amount, minorUnits): DecimalString`; Prisma models for users, organizations, memberships, stores, assignments, invitations, settings, purities, rates, products, inventory movements, sales, trade-ins, idempotency, and received old gold.

- [ ] **Step 1: Write decimal tests for 3-place weights, 4-place rates, 8-place exchange rates, negative rejection, excess precision, and final half-up money rounding.**
- [ ] **Step 2: Run `pnpm --filter @mizan/contracts test`; expect failures because the exact-value helpers do not exist.**
- [ ] **Step 3: Implement the shared decimal and ISO-currency primitives without JavaScript floating-point arithmetic.**
- [ ] **Step 4: Define the Prisma schema with organization-scoped product uniqueness, immutable historical snapshots, status enums, audit actors, and decimal column precisions from the spec.**
- [ ] **Step 5: Add integration tests proving identical product codes are allowed in different organizations and rejected within one organization, and that required tenant/store relations cannot cross organizations.**
- [ ] **Step 6: Apply the initial migration to local Supabase PostgreSQL and run contract plus database tests; expect all to pass.**
- [ ] **Step 7: Run Prisma validation/generation, typecheck, and lint.**
- [ ] **Step 8: Commit with `feat: add tenant-safe database foundation`.**

### Task 3: Authentication and request context

**Files:**
- Create: `apps/api/src/plugins/auth.ts`
- Create: `apps/api/src/plugins/request-context.ts`
- Create: `apps/api/src/modules/access/access.service.ts`
- Create: `apps/api/src/modules/access/access.errors.ts`
- Create: `apps/api/src/types/fastify.d.ts`
- Test: `apps/api/test/auth-context.integration.test.ts`

**Interfaces:**
- Consumes: Prisma `User`, `OrganizationMembership`, `StoreAssignment`.
- Produces: `authenticate(request): Promise<AuthIdentity>`; `resolveAccessContext(identity, organizationId, storeId): Promise<AccessContext>`; `AccessContext { userId; organizationId; storeId; role; settings }`.

- [x] **Step 1: Write tests for missing/invalid JWTs, valid token mapping, wrong organization/store IDs, inactive membership, removed assignment, and an existing user with multiple contexts.**
- [x] **Step 2: Run the auth-context test; expect failures because plugins and services do not exist.**
- [x] **Step 3: Implement Supabase JWKS verification and idempotent mapping from auth subject to application user.**
- [x] **Step 4: Implement current database-backed access resolution and attach `AccessContext` only after membership and assignment checks.**
- [x] **Step 5: Run the targeted test, including the stale-authorization cases; expect all to pass.**
- [x] **Step 6: Run API typecheck and lint.**
- [ ] **Step 7: Commit with `feat: enforce tenant request context` if explicitly authorized under `AGENTS.md`.**

### Task 4: Owner onboarding and organization selection

**Files:**
- Create: `packages/contracts/src/onboarding.ts`
- Create: `apps/api/src/modules/onboarding/onboarding.routes.ts`
- Create: `apps/api/src/modules/onboarding/onboarding.service.ts`
- Create: `apps/api/test/onboarding.integration.test.ts`
- Create: `apps/web/app/(auth)/register/page.tsx`
- Create: `apps/web/app/(auth)/workspace/page.tsx`
- Create: `apps/web/features/auth/owner-registration-form.tsx`
- Create: `apps/web/features/context/context-picker.tsx`
- Test: `apps/web/features/auth/owner-registration-form.test.tsx`

**Interfaces:**
- Produces: `POST /api/v1/onboarding`; `GET /api/v1/me/contexts`; `OnboardingRequest { organizationName; storeName; defaultCurrency }`; `OnboardingResult { organizationId; storeId; membershipId }`.

- [x] **Step 1: Write API tests proving onboarding creates the organization, store, owner membership, assignment, default settings, and default purities exactly once when retried.**
- [x] **Step 2: Run the onboarding API test; expect failure before routes exist.**
- [x] **Step 3: Implement the idempotent onboarding service and route, including recovery when the auth user already exists but application setup was interrupted.**
- [x] **Step 4: Test the required fields in Azerbaijani and English, ISO currency selection, error preservation, and context selection.**
- [x] **Step 5: Implement owner registration and the conditional organization/store context picker.**
- [x] **Step 6: Run API and web targeted tests; expect all to pass.**
- [x] **Step 7: Run workspace typecheck and lint.**
- [ ] **Step 8: Commit with `feat: add owner onboarding` if explicitly authorized under `AGENTS.md`.**

### Task 5: Invitations and salesperson access lifecycle

**Files:**
- Create: `packages/contracts/src/memberships.ts`
- Create: `apps/api/src/modules/memberships/membership.routes.ts`
- Create: `apps/api/src/modules/memberships/membership.service.ts`
- Create: `apps/api/test/memberships.integration.test.ts`
- Create: `apps/web/app/(app)/settings/users/page.tsx`
- Create: `apps/web/app/(auth)/invitations/[token]/page.tsx`
- Create: `apps/web/features/memberships/member-management.tsx`
- Create: `apps/web/features/memberships/invitation-acceptance.tsx`
- Test: `apps/web/features/memberships/member-management.test.tsx`

**Interfaces:**
- Produces: invitation create/list/revoke/resend/accept endpoints; membership deactivate/reactivate endpoints; assignment add/remove endpoints; `InvitationStatus` and `MembershipStatus` contracts.

- [x] **Step 1: Write API tests for owner-only invitation, store binding, expiry, single use, revoke/resend, existing-account acceptance, duplicate retry, deactivate/reactivate, assignment removal, and cross-tenant rejection.**
- [x] **Step 2: Run the membership tests; expect failure before the module exists.**
- [x] **Step 3: Implement invitation and membership lifecycle services. Send the Mizan link through configured SMTP, using Supabase Auth for password creation and verified email. Preserve historical membership rows.**
- [x] **Step 4: Write web tests for Azerbaijani pending/active/inactive states and the owner actions.**
- [x] **Step 5: Implement invitation acceptance and owner management screens, including captured-email development instructions.**
- [x] **Step 6: Run targeted tests and accept captured emails in a browser with both a new and existing account.**
- [x] **Step 7: Run workspace typecheck and lint.**
- [ ] **Step 8: Commit with `feat: manage salesperson access` if explicitly authorized under `AGENTS.md`.**

### Task 6: Organization settings, purities, and old-gold rates

**Files:**
- Create: `packages/contracts/src/settings.ts`
- Create: `apps/api/src/modules/settings/settings.routes.ts`
- Create: `apps/api/src/modules/settings/settings.service.ts`
- Create: `apps/api/test/settings.integration.test.ts`
- Create: `apps/web/app/(app)/settings/page.tsx`
- Create: `apps/web/features/settings/organization-settings-form.tsx`
- Create: `apps/web/features/settings/purity-rate-manager.tsx`
- Test: `apps/web/features/settings/organization-settings.test.tsx`

**Interfaces:**
- Produces: settings read/update; purity add/deactivate; effective old-gold rate create/list; `OrganizationSettings`, `PurityGrade`, `OldGoldRate` contracts.

- [ ] **Step 1: Write API tests for owner-only changes, default hidden acquisition costs, purity defaults `375/585/750/916/999`, grade deactivation with historical preservation, effective rate history, and tenant isolation.**
- [ ] **Step 2: Run the settings test; expect failure before the module exists.**
- [ ] **Step 3: Implement settings, purity, and effective-rate services and routes.**
- [ ] **Step 4: Write and implement web settings tests/forms for default currency display, acquisition-cost permission, purity lifecycle, and per-currency rate entry.**
- [ ] **Step 5: Run targeted API/web tests and verify salesperson responses omit acquisition costs when disabled.**
- [ ] **Step 6: Run workspace checks.**
- [ ] **Step 7: Commit with `feat: configure organization trading rules`.**

### Task 7: Zümrüd design foundation and authenticated shell

**Files:**
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/components/brand/brand-mark.tsx`
- Create: `apps/web/components/ui/{button,field,surface,dialog,status-badge,feedback}.tsx`
- Create: `apps/web/components/shell/{app-shell,sidebar,mobile-dock,glass-header}.tsx`
- Create: `apps/web/app/(auth)/sign-in/page.tsx`
- Test: `apps/web/components/ui/ui-accessibility.test.tsx`
- Test: `apps/web/features/auth/sign-in-form.test.tsx`

**Interfaces:**
- Produces: reusable accessible visual primitives; `AppShell`; authenticated route layout; Supabase sign-in UI.

- [ ] **Step 1: Write accessibility tests for labels, focus-visible controls, dialog focus restoration/Escape behavior, auth errors, and 44 px target classes.**
- [ ] **Step 2: Run web tests; expect failure before components exist.**
- [ ] **Step 3: Implement semantic Zümrüd tokens, Manrope loading/fallback, brand mark, UI primitives, and solid glass fallbacks from `DESIGN.md`.**
- [ ] **Step 4: Implement sign-in and the responsive authenticated shell with only shipped destinations.**
- [ ] **Step 5: Run tests and manually inspect 320, 375, 430, 768, 1024, and 1440 px widths.**
- [ ] **Step 6: Run web typecheck, lint, and build.**
- [ ] **Step 7: Commit with `feat: add Mizan design foundation`.**

### Task 8: Product and inventory API

**Files:**
- Create: `packages/contracts/src/products.ts`
- Create: `apps/api/src/modules/products/product.routes.ts`
- Create: `apps/api/src/modules/products/product.service.ts`
- Create: `apps/api/src/modules/products/product.presenter.ts`
- Create: `apps/api/test/products.integration.test.ts`

**Interfaces:**
- Produces: `POST /api/v1/products`; `GET /api/v1/products`; `GET /api/v1/products/:id`; `POST /api/v1/products/:id/photo-upload` returning a short-lived signed upload target; `POST /api/v1/products/:id/photo-confirm` verifying and persisting object identity; `ProductCreateInput`; `ProductListItem`; `ProductDetail` with permission-filtered cost.

- [ ] **Step 1: Write API tests for creation plus opening movement, organization-unique codes, active purity, exact weight/cost validation, search by code/name, store scope, sold status, acquisition-cost filtering, and tenant-bound signed photo upload/confirmation.**
- [ ] **Step 2: Run product tests; expect failure before the module exists.**
- [ ] **Step 3: Implement transactional product creation, tenant-safe search/detail queries, role-aware presenters, and private object upload/confirmation that never accepts an arbitrary cross-tenant path.**
- [ ] **Step 4: Add an authorization test that swaps organization and store IDs while reusing valid product IDs.**
- [ ] **Step 5: Run product tests, Prisma checks, API typecheck, and lint.**
- [ ] **Step 6: Commit with `feat: add tenant-safe product inventory`.**

### Task 9: Product and inventory interface

**Files:**
- Create: `apps/web/app/(app)/products/page.tsx`
- Create: `apps/web/app/(app)/products/new/page.tsx`
- Create: `apps/web/app/(app)/products/[id]/page.tsx`
- Create: `apps/web/features/products/{product-form,product-list,product-detail,product-photo}.tsx`
- Create: `apps/web/lib/api-client.ts`
- Test: `apps/web/features/products/product-workflow.test.tsx`

**Interfaces:**
- Consumes: Task 8 product contracts/endpoints and Task 7 UI primitives.
- Produces: add → find → detail workflow; authenticated API client with organization/store context and token.

- [ ] **Step 1: Write component tests for duplicate-code inline feedback, invalid measurement preservation, search, empty/loading/error states, hidden cost, and optional photo behavior.**
- [ ] **Step 2: Run product web tests; expect failure before features exist.**
- [ ] **Step 3: Implement the authenticated API client and product pages using Azerbaijani copy and exact string values.**
- [ ] **Step 4: Implement optional private Supabase Storage photo upload through an authorized API flow and purposeful category fallbacks.**
- [ ] **Step 5: Run tests and manually complete add → refresh → search → detail as owner and salesperson on mobile and desktop.**
- [ ] **Step 6: Run web checks.**
- [ ] **Step 7: Commit with `feat: add product inventory workflow`.**

### Task 10: Transaction-safe sales and trade-in API

**Files:**
- Create: `packages/contracts/src/sales.ts`
- Create: `apps/api/src/modules/sales/sale.routes.ts`
- Create: `apps/api/src/modules/sales/sale.service.ts`
- Create: `apps/api/src/modules/sales/settlement.ts`
- Create: `apps/api/src/modules/sales/sale.presenter.ts`
- Test: `apps/api/test/sales.integration.test.ts`
- Test: `apps/api/test/sale-concurrency.integration.test.ts`

**Interfaces:**
- Produces: `calculateSettlement(input): SettlementSnapshot`; `POST /api/v1/sales` with required `Idempotency-Key`; `GET /api/v1/sales/:id`; immutable `SaleResult` including original/default currency values, trade-ins, payment or payout, and sold item snapshot.

- [ ] **Step 1: Write settlement tests for default currency, foreign currency/manual rate, 3/4/8-place inputs, final half-up rounding, multiple trade-in lines, salesperson override, positive payment, zero balance, and cash payout.**
- [ ] **Step 2: Run settlement tests; expect failure before the calculator exists.**
- [ ] **Step 3: Implement decimal-safe `calculateSettlement` with no JavaScript number conversion.**
- [ ] **Step 4: Write integration tests for successful ordinary/trade-in sales, missing/stale rate, inactive purity, unauthorized store, rollback injection, same-key retry, different-key concurrency, movement creation, and immutable snapshots.**
- [ ] **Step 5: Run integration tests; expect failure before the route/service exists.**
- [ ] **Step 6: Implement the Prisma transaction using an atomic in-stock claim, idempotency record, sale/trade-in snapshots, movements, received-old-gold assets, and final sold status.**
- [ ] **Step 7: Run targeted tests repeatedly, including the concurrency case; expect one sale and one deterministic conflict/original response.**
- [ ] **Step 8: Run API/database checks.**
- [ ] **Step 9: Commit with `feat: record transaction-safe sales`.**

### Task 11: Sales and old-gold interface

**Files:**
- Create: `apps/web/app/(app)/sales/new/page.tsx`
- Create: `apps/web/app/(app)/sales/[id]/page.tsx`
- Create: `apps/web/features/sales/{sale-form,product-lookup,trade-in-lines,settlement-summary,sale-confirmation}.tsx`
- Test: `apps/web/features/sales/sale-workflow.test.tsx`

**Interfaces:**
- Consumes: Task 10 sales contracts/endpoints and Task 9 product lookup.
- Produces: responsive ordinary/old-gold sale flow with idempotent submission and persisted result display.

- [ ] **Step 1: Write tests for prefilled product, unavailable item, default/foreign currency, exchange-rate requirement, calculated and overridden trade-in value, payment/zero/payout summaries, disabled double submission, confirmation, and recoverable errors preserving input.**
- [ ] **Step 2: Run sale web tests; expect failure before components exist.**
- [ ] **Step 3: Implement the sale form and settlement preview using server-compatible decimal strings and a client-generated idempotency key per logical submission.**
- [ ] **Step 4: Implement accessible confirmation and result views showing original and default currency, rate, trade-in calculation/override, actor, date, item status, and payment or payout.**
- [ ] **Step 5: Run tests and manually exercise ordinary sale, trade-in payment, and trade-in cash payout at mobile and desktop widths.**
- [ ] **Step 6: Run web checks.**
- [ ] **Step 7: Commit with `feat: add sales and trade-in workflow`.**

### Task 12: End-to-end verification, backup, and handoff

**Files:**
- Create: `tests/e2e/first-milestone.spec.ts`
- Create: `playwright.config.ts`
- Create: `docs/LOCAL_SETUP.md`
- Create: `docs/BACKUP_RESTORE.md`
- Create or update: `PROJECT_STATE.md`
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: reproducible local setup, verified backup/restore procedure, and milestone acceptance evidence.

- [ ] **Step 1: Write the Playwright scenario for owner registration, store setup, captured invitation, new/existing salesperson acceptance, settings, product creation, refresh/sign-in persistence, lookup, ordinary sale, trade-in payout, and history.**
- [ ] **Step 2: Add negative scenarios for duplicate code, invalid decimals, hidden acquisition cost, revoked assignment, expired invitation, duplicate submission, and already-sold item.**
- [ ] **Step 3: Run the end-to-end suite against a clean local Supabase environment; fix only failures within milestone scope until green.**
- [ ] **Step 4: Document exact setup, environment variables, service URLs, migration, test, build, and troubleshooting commands.**
- [ ] **Step 5: Create a database backup with documented local tools, restore it into an isolated local database, and verify representative organization, product, sale, trade-in, and audit records.**
- [ ] **Step 6: Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm exec playwright test`; record actual results in `PROJECT_STATE.md`.**
- [ ] **Step 7: Review at 320, 375, 430, 768, 1024, and 1440 px plus keyboard and reduced-motion modes; record any unverified state.**
- [ ] **Step 8: Commit with `docs: complete first milestone handoff`.**

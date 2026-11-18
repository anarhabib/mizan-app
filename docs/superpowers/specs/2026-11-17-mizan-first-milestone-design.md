# Mizan first milestone design

**Date:** 2026-11-17

**Status:** Approved

## Intent

Build the first real, locally runnable version of Mizan for a small jewelry business while preserving a clean path to a multi-tenant SaaS product. The first milestone must prove the complete operational loop: an owner creates a business, invites a salesperson, a user records an individually identified jewelry item, finds it in inventory, and completes either an ordinary sale or a sale with an old-gold trade-in. Data must persist in a real PostgreSQL database and critical inventory changes must be transaction-safe.

The product runs only on the developer's Windows PC during development. Cloud deployment is outside this milestone, but the boundaries must allow the same application to move to hosted infrastructure later.

## Goals

- Run a real Next.js web app, Fastify API, and local Supabase stack.
- Let an owner register, create an organization and its first store, and sign in.
- Let an owner invite a salesperson by email and assign the salesperson to a store.
- Enforce `Owner` and `Salesperson` roles in Fastify.
- Let the owner decide whether salespeople can see acquisition costs; default to hidden.
- Create, search, inspect, and sell uniquely coded jewelry items.
- Support ordinary sales and old-gold trade-ins in the first sale workflow.
- Calculate a suggested old-gold value from weight, purity, and the configured purchase rate per gram, while allowing the salesperson to override it.
- Preserve the inputs, calculated value, accepted value, and applied rate on the historical transaction.
- Use exact decimal storage and arithmetic for money and weights.
- Work on mobile and desktop using the default Zümrüd visual system and selectable Azerbaijani and English UI text.
- Provide reproducible local setup, migrations, seed/test data boundaries, and meaningful automated verification.

## Non-goals

- Cloud deployment, production domains, or production email delivery.
- Subscription plans, billing, trials, quotas, or SaaS plan enforcement.
- Multiple selectable color palettes; only Zümrüd ships now.
- Microservices, event buses, or independently deployed domain services.
- Returns, cancellations, stock reconciliation, reporting, customer catalog, barcode scanning, or camera recognition unless required to complete the core workflow.
- A pricing formula for estimated retail selling price. The actual sale amount is entered explicitly.
- Turning received old gold into an ordinary saleable jewelry product. It remains a separately tracked received asset.

## Constraints and sources

- `DESIGN.md` is the source of truth for visual behavior and responsive layout, except that palette switching is deferred.
- This document supersedes conflicting technical and scope assumptions in `PROJECT_CONTEXT.md` for the first milestone.
- Azerbaijani is the default interface language and English is available in the language picker. Weights use grams, monetary values carry an explicit ISO 4217 currency code, and business dates use Asia/Baku. Use English folder names, file names, and route paths.
- Database credentials and privileged Supabase credentials remain server-side.
- Every organization-owned record is scoped by organization; store-owned records are additionally scoped by store.
- Authorization is enforced by Fastify before business data is read or changed.
- Historical sales, trade-ins, rates, and inventory movements are append-only business records. Corrections must not silently overwrite history.

## Approaches considered

### Next.js with direct Supabase access

This has the fewest application processes and is fast to start. Critical rules would be split across Row Level Security policies, SQL functions, and frontend calls. That makes inventory and financial behavior harder to find and test as the product grows.

### Full-stack Next.js with Supabase

Next.js route handlers or server actions would contain the business logic. This is simpler to deploy than a separate API, but it couples the management UI and backend closely and makes later non-web clients less natural.

### Next.js, Fastify, Prisma, and Supabase — selected

Next.js provides the management UI and a future path for public catalogs and marketing pages. Fastify owns authentication checks, authorization, validation, inventory, and financial workflows. Prisma supplies the relational schema, migrations, exact decimal handling, and database transactions. Supabase supplies local PostgreSQL, authentication, storage, and development email capture, with a later path to managed infrastructure.

The extra API process is justified by the importance of inventory correctness and the longer-term SaaS goal. The system remains a modular monolith: one web app, one API, and one database.

## Repository shape

Use a pnpm workspace and a task runner only if it demonstrably improves the local workflow. The intended boundaries are:

```text
apps/
  web/       Next.js application
  api/       Fastify application
packages/
  database/  Prisma schema, migrations, and database client
  contracts/ shared request/response schemas and inferred TypeScript types
  config/    shared TypeScript/lint configuration where useful
```

Keep domain logic in the Fastify application, organized by modules such as identity, organizations, stores, memberships, products, inventory, pricing, and sales. Shared packages must not become a dumping ground for business logic.

## Identity, tenancy, and authorization

Supabase Auth owns user credentials, password creation, sessions, and email verification/invitation mechanics. Next.js obtains the user's session and sends the access token to Fastify. Fastify verifies the token and resolves the local application user and memberships before handling protected requests.

The core tenancy model is:

```text
User ──< OrganizationMembership >── Organization ──< Store
                     │
                     └── role: OWNER | SALESPERSON

Store ──< StoreAssignment >── OrganizationMembership
```

The owner onboarding operation creates an auth user, application user, organization, first store, owner membership, and store assignment. Where Supabase signup prevents a single cross-system database transaction, the flow must be idempotent and resumable so retries do not create duplicate organizations.

An owner invites a salesperson by email and chooses a store. Invitations are single-use, expire, and cannot grant access outside the owner's organization. Local Supabase email capture is used during development. The invited user sets a password and receives a salesperson membership and store assignment only after accepting a valid invitation.

The owner-management screen lists pending and accepted invitations and active and inactive salespeople. An owner can revoke a pending invitation, resend an expired invitation, deactivate or reactivate a salesperson membership, and add or remove store assignments. Deactivation and assignment removal preserve historical records and actor references. Fastify evaluates the current membership and assignment state on every protected request so a user with an existing auth session loses application access immediately when authorization is removed.

An existing Supabase-authenticated user can accept invitations to additional stores or organizations without creating another login. Roles and assignments belong to each membership rather than to the global user. When a user can access more than one organization or store, the application presents an explicit context selector. Fastify validates the selected context against current memberships on every protected request; changing context never combines or leaks tenant data.

Organization settings include `salespersonCanViewAcquisitionCost`, defaulting to `false`. Fastify omits protected acquisition-cost fields from responses when the setting and role do not permit access. UI hiding is supplementary, not the security boundary.

The owner selects an organization default currency during onboarding. It is the preselected currency for product costs, old-gold rates, sales, settlements, and reporting.

Each organization begins with common purity grades `375`, `585`, `750`, `916`, and `999`. Owners can add and deactivate grades. Deactivation removes a grade from new product, rate, and trade-in choices but never changes or invalidates existing products, configured historical rates, sales, or trade-in records.

## Product and inventory model

Each physical jewelry piece is a distinct product record. Product codes are unique within an organization so the same code cannot ambiguously identify two items across its stores. Different organizations may independently use the same code. Two otherwise identical physical pieces within one organization still require different codes because each is tracked separately. The first product form includes:

- code;
- name;
- category;
- purity;
- total weight in grams;
- acquisition cost in AZN;
- optional photo;
- optional note.

Weight and cost must be positive exact decimals. Purity is validated against the organization's active grades rather than accepted as arbitrary display text. The product begins in `IN_STOCK` status at its selected store. Product creation also writes an inventory movement recording the initial stock entry.

Weights accept and store up to three decimal places in grams. User-entered monetary amounts follow the selected currency's ISO minor-unit precision, normally two decimal places. Per-gram rates accept up to four decimal places, and exchange rates accept up to eight decimal places. Database calculations retain sufficient additional precision to avoid intermediate loss. Customer settlement is rounded once, after totals and conversion are calculated, to the settlement currency's minor unit using half-up rounding. Historical records preserve both entered values and finalized calculated results.

The inventory list supports search by code or name and shows availability, purity, and weight. The detail view shows status, product attributes, movement history, and recorded sale information. Acquisition cost appears only when authorization permits it.

Product photos use Supabase Storage. The database stores object identity and metadata rather than public URLs. Photo access follows organization/store authorization. Photo upload is optional and must not block the core workflow.

## Configured old-gold prices

The organization can configure an old-gold purchase rate per gram for each supported purity. A rate change creates a new effective rate record or otherwise preserves price history; it must not rewrite past sales.

During a trade-in, the suggested value is:

```text
suggested value = accepted weight in grams × configured rate per gram for the selected purity
```

The API performs this calculation using decimal-safe arithmetic. The salesperson may override the suggested value without owner approval in this milestone. The UI clearly distinguishes the calculated suggestion from the final accepted value.

## Sale and trade-in workflow

A sale contains one uniquely coded jewelry item in this milestone. The salesperson selects an in-stock item, confirms its identifying details, enters the actual sale amount, and optionally adds one or more old-gold trade-in lines. Each trade-in line records purity, weight, the applied configured rate, calculated value, final accepted value, and whether it was overridden.

Price the sale, value old-gold trade-ins, and calculate the balance in the organization's default currency. A customer can pay in a foreign currency. The store retains the cash in the currency received, and the salesperson enters the exchange rate to calculate its default-currency equivalent. The sale history preserves the original payment amount and currency, the exchange rate, and the converted amount. Automatic exchange-rate retrieval is deferred.

When the converted payment exceeds the balance due, the store gives the difference as cash change in the organization's default currency. Record the change with the payment in the same sale. For example, if the balance due is 170 AZN and the customer pays 110 USD at 1.70 AZN per USD, record 110 USD received, its 187 AZN equivalent, and 17 AZN in change.

The settlement summary shows:

```text
amount due = actual sale amount - total accepted trade-in value
```

When the result is negative, the sale records the absolute difference as a cash payout from the store to the customer. The payout is part of the same settlement and database transaction; it is not store credit. The confirmation and historical record clearly distinguish money collected from money paid out.

The sale confirmation displays the item, actual amount, trade-in total, and remaining settlement before submission. User input remains available after recoverable errors.

Fastify completes the sale inside one Prisma transaction. It must:

1. Verify the user can access the store and record sales.
2. Atomically claim the item only if it is still `IN_STOCK`.
3. Create the sale and its item snapshot.
4. Create trade-in records and snapshots when present.
5. Create the outgoing product inventory movement.
6. Create received-old-gold inventory movements/assets.
7. Commit the item status as `SOLD`.

The operation accepts an idempotency key. A repeated submission with the same key returns the original result; a competing request for the same item cannot produce a second completed sale. Any failure rolls back all database changes.

Received old gold is stored separately from individually saleable products. It records the source sale, purity, weight, and accepted valuation and begins in a `RECEIVED` state. Later processing and disposition are outside this milestone.

## API and validation

Fastify exposes versioned JSON endpoints under `/api/v1`. Request and response contracts use the project's selected schema validation approach and are shared with the web app through generated or inferred TypeScript types. API errors have stable machine codes plus concise Azerbaijani user-facing messages where appropriate.

Validation occurs at the API boundary and is repeated by database constraints for invariants such as uniqueness and valid relations. The frontend provides immediate field feedback but never substitutes for server validation.

Core API areas are authentication/session context, onboarding, invitations, organization settings, store assignments, old-gold rates, products, inventory lookup, product details, and sales.

## User experience

Use the Zümrüd semantic tokens, Manrope typography, accessible shared controls, the Mizan mark, and the responsive shell described in `DESIGN.md`. Only implemented destinations appear in navigation.

The milestone screens are:

- owner registration and business/store setup;
- sign in and invitation acceptance;
- owner user/invitation management;
- the acquisition-cost visibility setting;
- old-gold rate configuration;
- product creation;
- inventory/product list and search;
- product details;
- new sale, optional trade-in, confirmation, and result.

Mobile forms use one column and preserve access to actions above fixed navigation. Desktop uses the documented sidebar. All interactive controls meet the documented focus, target-size, contrast, keyboard, dialog, and reduced-motion requirements.

## Failure handling and auditability

- Duplicate product codes return a field-level conflict without losing other form values.
- Invalid decimal, weight, purity, amount, or rate input is rejected explicitly.
- Expired, reused, or mismatched invitations do not create memberships.
- Unauthorized store and organization identifiers behave consistently without leaking another tenant's existence.
- A stale product view cannot sell an item that has already been sold.
- Sale retries are safe, and transaction failures leave the product, sale, trade-in, and movement records consistent.
- Historical sale amount, applied old-gold rate, calculated value, override value, actor, and timestamps remain inspectable.
- Security-relevant and financial changes record the acting user.

## Local development

Docker runs the local Supabase services, including PostgreSQL, Auth, Storage, and email capture. Next.js and Fastify run as normal local Node.js processes for fast reload. Environment examples contain placeholders only.

The repository documents prerequisites, initial setup, service startup, Prisma migration and generation commands, local URLs, invitation-email inspection, test execution, and safe reset/backup procedures. Persistent Docker volumes protect ordinary development data. Before pilot use, backup and restore must be tested against the stated maximum acceptable data loss of 24 hours.

## Verification

Automated tests must cover business-critical API behavior, including:

- organization/store isolation and role authorization;
- acquisition-cost response filtering;
- owner onboarding retry behavior;
- invitation expiry, single use, and organization/store binding;
- invitation revoke/resend, salesperson deactivate/reactivate, and store-assignment changes, including existing sessions;
- acceptance by an existing user and safe organization/store context switching;
- purity-grade defaults, owner management, deactivation, and historical preservation;
- product-code uniqueness and decimal validation;
- successful ordinary sale;
- successful trade-in sale and saved calculation snapshots;
- foreign-currency payment with the original amount and currency, manual exchange rate, and default-currency equivalent;
- change recorded in the default currency when foreign cash exceeds the balance due;
- allowed salesperson override;
- duplicate submission and concurrent-sale prevention;
- full rollback on failure.

An end-to-end browser check must create an owner, accept a salesperson invitation, add and find a product, complete both sale variants, refresh, sign in again, and confirm persisted history. Representative mobile and desktop sizes from `DESIGN.md` must be checked, with special attention to Azerbaijani copy, keyboard flow, table overflow, dialogs, and fixed mobile navigation.

## Decisions left to the builder

- Exact compatible package versions at implementation time.
- The concrete schema-validation library and test runner, preferring mature tools supported by the chosen frameworks.
- Whether a lightweight workspace task runner adds enough value beyond pnpm scripts.
- Internal module/file naming consistent with the generated framework conventions.
- The visual composition of trade-in fields within the approved sales layout, provided all documented values and states remain clear.

## Product decisions still requiring confirmation

None for this milestone.

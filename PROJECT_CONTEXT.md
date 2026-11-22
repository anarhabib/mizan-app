# Misqal Project Context

## Purpose

Misqal is a mobile-first business management platform for jewelry retailers, not a jewelry retailer. It serves store owners and salespeople with inventory, gold weight and purity tracking, acquisition-cost records, sales, trade-ins, and financial history. The primary workflows are designed for mobile use in a jewelry shop. `misqal.az` is the intended domain; registration, DNS, and deployment are unverified.

## Confirmed Decisions

| Topic                  | Decision                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Starting point         | Start from scratch in a new repository                                                                                                                   |
| First milestone        | Add a product → find it in inventory → record its sale, using a real database                                                                            |
| Backend                | Fastify for the API and Prisma ORM for database access and migrations                                                                                    |
| Frontend               | Vite, React 19, TypeScript, TanStack Router and Query                                                                                                    |
| Local platform         | Local Supabase through Docker for PostgreSQL, Auth, Storage, and development email capture                                                               |
| Architecture           | pnpm monorepo with separate Vite web and Fastify API applications; modular monolith                                                                      |
| Tenancy                | Organization and store scoped from the first milestone, with Owner and Salesperson roles                                                                 |
| Initial rollout target | One family-owned store at one location                                                                                                                   |
| Localization           | Azerbaijani (default), English, and Russian interface options, organization default ISO currency with optional foreign-currency payment, weight in grams |
| Inventory              | Track each piece of jewelry individually with its own product record and unique code                                                                     |
| Acquisition cost       | Enter each item's initial acquisition cost manually                                                                                                      |
| Selling price          | The selling price can change. Show the estimated selling price on the product record and the actual sale amount on the transaction                       |
| Trade-ins              | The first milestone supports old-gold trade-ins, configurable purity rates, salesperson overrides, and cash payouts                                      |
| Recovery               | Before the family store starts using the app, verify that backup and restore can meet the maximum acceptable data loss of 24 hours                       |

## Brand and design

- Official logo concept: 03 — Flat Ends, supplied SVGs in `apps/web/src/assets/branding/`.
- The implemented UI and semantic palette are documented in [DESIGN.md](DESIGN.md). Preserve its current shadcn preset and theme tokens.

Preserve the mobile-first layout and desktop sidebar. Do not treat the brand asset's lime as an application accent or redesign the interface.

## Implemented product baseline

The current implementation includes Supabase email authentication and recovery; workspace onboarding and store selection; owner-managed invitations and permissions; scoped product creation, inventory lookup, product history and optional private photos; acquisition rates and purity settings; multi-item sales, old-gold trade-ins, payment settlement, previews, receipts, and sales history. The app supports Azerbaijani, English, and Russian. See [PROJECT_STATE.md](PROJECT_STATE.md) for dated implementation and verification evidence, and [docs/ROADMAP.md](docs/ROADMAP.md) for work that remains planned.

### Acceptance Criteria

- The saved product appears in inventory after a page refresh and after signing in again.
- The system rejects duplicate product codes and repeat sales of the same item.
- After a failed sale attempt, the item's inventory status and its sales records remain consistent.
- The database stores weight and monetary values using exact decimal types. The interface displays AZN amounts to two decimal places.
- Inventory and sales operations require a signed-in user with permission to access the store. The Fastify API checks that permission before accessing store data.
- The full product creation, inventory lookup, and sale workflow works on mobile and desktop.

## Architecture and compatibility

The frontend calls the Fastify API. Prisma owns the PostgreSQL schema, migrations, queries, and transactions. Keep database credentials on the server and scope store data access to the authenticated user's authorized store. `mizan` schema names, `@mizan/*` package names, and `MIZAN_*` environment variables are legacy internal identifiers intentionally retained for compatibility; do not rename them as part of branding.

The current foundation is Vite with React and TypeScript for the web application, Fastify for the API, Prisma for database access and migrations, and Supabase for local PostgreSQL, Auth, private Storage, and captured development email. The repository is a pnpm monorepo and the applications form a modular monolith. Current conventions are in [AGENTS.md](AGENTS.md), [docs/FRONTEND.md](docs/FRONTEND.md), and [docs/API_NOTES.md](docs/API_NOTES.md); the archived first-milestone specification is historical.

Use [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for setup and migration instructions. Verify the acceptance criteria with test data and report any checks that could not be run.

## Business rules

- Each jewelry piece has an individual product record and unique code.
- Weights are grams with up to 3 decimal places; gold purity is integer fineness, not a percentage.
- Money and weights remain exact decimal values. Never silently round, convert, or reinterpret entered or persisted values.
- A sale records its actual negotiated value and date; historical sale and acquisition snapshots remain stable when later rates change.
- Sales, trade-ins, and stock movements must be transactionally consistent and prevent duplicate or invalid inventory movements.
- Organization and store access is authorized server-side. Money is displayed with its ISO currency code; do not assume AZN.
- Keep the recovery objective of no more than 24 hours of data loss, and verify backups before the pilot.

## Planned work and open decisions

- **Goods receipt.** A product record describes an individual item. A goods receipt records its purchase and entry into inventory. The planned fields include receipt date, weight, purchase price per gram, and total acquisition cost. Supplier details, batch receipts, and how to enter opening inventory are still open.
- **Estimated selling price.** The estimate is intended to use a daily price per gram. How to account for gold purity, labor costs, and margin, and where to obtain the daily price, are still open. Implement the pricing formula once it has been approved.
- **Old-gold inventory.** Sales record trade-ins and their settlement. Broader management and reconciliation of received old-gold stock remain planned.
- **Barcode and camera.** The planned flow is to scan a barcode, find the item in inventory, and offer a button to proceed to the sale. Allow manual code entry when the barcode cannot be read. Photo-based recognition, the web camera menu, and PWA behavior will be specified separately.
- **Catalog.** A customer-facing browsing screen displays product photos, gold purity, weight, and other relevant attributes. Prices are hidden.
- **Reporting.** Compare month-end and quarter-end inventory with current stock. Define the scope of each report as the work is phased.
- **SaaS plans.** The longer-term goal is to offer Misqal to other stores. A limited free plan is under consideration. Final pricing, limits, and paid-plan features are still open.

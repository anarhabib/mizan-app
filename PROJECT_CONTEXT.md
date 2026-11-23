# Misqal Project Context for Codex

## Purpose

Misqal is a management app for small jewelry stores. A family-owned jewelry store will pilot it at a single location. The primary user is a salesperson who manages day-to-day operations independently. The app brings product records, inventory status, and sales history together. A salesperson should be able to find a piece of jewelry, check its weight, gold purity, and availability, and then record the sale in a single transaction. The intended public domain is `misqal.az`.

## Confirmed Decisions

| Topic | Decision |
| --- | --- |
| Starting point | Start from scratch in a new repository |
| First milestone | Add a product → find it in inventory → record its sale, using a real database |
| Backend | Fastify for the API and Prisma ORM for database access and migrations |
| Frontend | Vite, React, TanStack Router, and TypeScript |
| Local platform | Local Supabase through Docker for PostgreSQL, Auth, Storage, and development email capture |
| Architecture | pnpm monorepo with separate Vite web and Fastify API applications |
| Tenancy | Organization and store scoped from the first milestone, with Owner and Salesperson roles |
| Initial deployment | One family-owned store at one location |
| Localization | Azerbaijani (default), English, and Russian interface options, organization default ISO currency with optional foreign-currency payment, weight in grams |
| Inventory | Track each piece of jewelry individually with its own product record and unique code |
| Acquisition cost | Enter each item's initial acquisition cost manually |
| Selling price | The selling price can change. Show the estimated selling price on the product record and the actual sale amount on the transaction |
| Trade-ins | The first milestone supports old-gold trade-ins, configurable purity rates, salesperson overrides, and cash payouts |
| Recovery | Before the family store starts using the app, verify that backup and restore can meet the maximum acceptable data loss of 24 hours |

## Design References

- [Historical interactive demo](https://qizil-anbar-idareetme.auralchess4.chatgpt.site/)
- [App screen preview](https://chatgpt.com/library?file_id=libfile_e6773243cbd481918c532f72612ddb2f&account_id=personal)

Use mobile bottom navigation and a left sidebar on desktop. [DESIGN.md](DESIGN.md) describes the current frontend and Misqal assets. The linked demo and screen preview are historical references.

## First Implementation Task

1. In the new repository, build sign-in, a product creation form, an inventory list, a product details screen, and a sales form. Localize these screens in Azerbaijani, English, and Russian. Connect the core workflow to a real database through the Fastify API and Prisma. If sample data is needed, keep it separate for testing.
2. Let the salesperson save a product with its code, type, gold purity, weight, and acquisition cost. Show a clear inline error for a duplicate code or invalid measurements. If the design includes a photo field, make it optional for the core workflow.
3. Show the saved product in the inventory list. Let the salesperson find it by code and open its details. Before the sale, show availability, weight, purity, acquisition cost, and the estimated selling price when available.
4. Let the salesperson enter the actual sale amount and confirm the sale. In the Fastify sales endpoint, use a single Prisma transaction to record the sale and mark the item as sold. Double-clicks and concurrent requests must produce at most one sale for the same item.
5. Keep the sale amount and date visible on the sold item's record. Preserve the original sale amount when the daily price changes.

### Acceptance Criteria

- The saved product appears in inventory after a page refresh and after signing in again.
- The system rejects duplicate product codes and repeat sales of the same item.
- After a failed sale attempt, the item's inventory status and its sales records remain consistent.
- The database stores weight and monetary values using exact decimal types. The interface displays AZN amounts to two decimal places.
- Inventory and sales operations require a signed-in user with permission to access the store. The Fastify API checks that permission before accessing store data.
- The full product creation, inventory lookup, and sale workflow works on mobile and desktop.

## Technical Starting Point

Build the backend API with Fastify. Use Prisma ORM for the database schema, migrations, queries, and transactions. The frontend calls the Fastify API. Keep database credentials on the server. Scope store data access to the authenticated user’s authorized store, even though the initial deployment serves one store.

The approved foundation is Next.js with TypeScript for the web application, Fastify for the API, Prisma for database access and migrations, and local Supabase for PostgreSQL, Auth, Storage, and captured development email. The repository is a pnpm monorepo and the applications form a modular monolith. The detailed approved design is [the archived first-milestone specification](docs/archive/first-milestone-spec.md).

At the end of the first task, document local setup, required environment variables, how to run the Fastify API, and how to apply Prisma migrations. Verify the acceptance criteria with test data and report any checks you could not run.

## Later MVP Work and Open Decisions

- **Goods receipt.** A product record describes an individual item. A goods receipt records its purchase and entry into inventory. The planned fields include receipt date, weight, purchase price per gram, and total acquisition cost. Supplier details, batch receipts, and how to enter opening inventory are still open.
- **Gold pricing.** Gold API spot quotes and official CBAR USD/AZN provide a read-only market reference by fineness. Owners configure retail selling, scrap buying and scrap selling in each store with independent defaults and purity overrides. Methods are fixed price, percentage or amount adjustment. Retail follows the market when no rule applies. Product estimates require net gold weight and use official CBAR conversion when applicable. Workmanship pricing remains open.
- **Old-gold trade-ins.** Checkout suggests the store's effective scrap buying rate and keeps an authorized agreed amount when entered manually. Completed trade-ins retain the agreed amount and applicable pricing snapshots. Their credit is applied separately from monetary tender. Received old gold remains recorded in inventory. Scrap selling rules are configurable. Scrap selling transactions are outside the current scope.
- **Barcode and camera.** The planned flow is to scan a barcode, find the item in inventory, and offer a button to proceed to the sale. Allow manual code entry when the barcode cannot be read. Photo-based recognition, the web camera menu, and PWA behavior will be specified separately.
- **Catalog.** A customer-facing browsing screen displays product photos, gold purity, weight, and other relevant attributes. Prices are hidden.
- **Reporting.** Market observations and store pricing rule history are available through the API. Compare month-end and quarter-end inventory with current stock once the inventory reporting scope is defined. The historical dashboard chart is Task 14.
- **SaaS plans.** The longer-term goal is to offer Misqal to other stores. A limited free plan is under consideration. Final pricing, limits, and paid-plan features are still open.

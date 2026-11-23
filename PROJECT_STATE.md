# Misqal project state

## Task 16 — jewelry products and gemstones (November 23, 2026)

- `packages/database/prisma/migrations/202611230004_product_jewelry` extends Product with gold metal type, optional fixed selling price and acquisition components. `ProductGemstone` stores ordered gemstone groups under the existing organization, store and product IDs. Legacy rows retain their gross weight, recorded alloy weight, acquisition costs and inventory and sales history.
- `packages/contracts/src/products.ts` and `apps/api/src/modules/products` validate per-gram or supplier-total acquisition, exact component sums and decimal carat weights. Supplier totals and component amounts require Owner mode. The legacy staff cost setting still governs per-gram acquisition visibility. Checkout continues to snapshot the full acquisition total for profit and below-cost confirmation.
- `apps/web/src/features/products` adds gemstone intake and detail in the existing panel, plus an inventory filter for recorded groups. Checkout can prefill a same-currency fixed price and keeps gemstone gold estimates separate from the final sale amount. Gross jewelry weight, net alloy weight and fine gold content have separate labels. Silver and platinum require a separate decision on purity and pricing.
- Prisma validation and schema parity passed on disposable PostgreSQL. Before-and-after comparisons and Fastify reads verified legacy available and sold products, sale snapshots, and partially paid receipts. Contracts, database, API and web tests passed (26, 3, 74 and 168). Changed-file lint and formatting, TypeScript and the production build passed. Chromium fixtures covered 390px and 1280px in both themes, plus Azerbaijani and Russian labels. Live Storage was skipped. The development migration is pending. Task branch is `task/16-jewelry-products-gemstones`.

## Task 15 — table, filter and status consistency (November 23, 2026)

- `ProductList.tsx` and `SaleList.tsx` use shadcn tables with localized desktop column headers, right-aligned numeric values and named detail actions. Mobile uses the existing cards, and the Products toolbar scrolls within one row. Sales search enforces the API's 160-character limit.
- `SalePaymentStatusBadge.tsx` gives Sales, receipts and customer purchase history the same payment badges. Purchase history reads the exact paid and outstanding amounts already returned by the API and disables cursor navigation while showing a placeholder page. Product credit status still follows outstanding debt on the linked sale. `MarketWidgets.tsx` and `GoldPricingSection.tsx` align desktop rate columns, with a sticky header in the dashboard's bounded rate list.
- Contracts build, web TypeScript and production build, changed-file lint and formatting, and 33 targeted Vitest tests passed. Chromium with API fixtures passed at 390px and 1280px in both themes, including localized headings, payment statuses, cursor resets, repayment refresh and store and organization switching. AZ and RU labels were checked alongside EN. Live database integration, physical devices and other browsers were not exercised. Changes are local on `task/15-table-status-polish`.

### Follow-up — table headers, thumbnails and categories

- The shared table header uses the muted surface in both themes. `ProductList.tsx` and `SaleList.tsx` show product thumbnails and a localized Category column on desktop. Sales shows the first product and its category for multi-product receipts.
- `product.storage.ts` signs the scoped photos for each requested page in one batch. The protected Products and Sales lists return optional `thumbnailUrl` values with `photos=1`. A missing or broken photo shows a placeholder. No migration is required.
- Contracts and API builds, web TypeScript, changed-source lint and formatting, and 11 targeted tests passed. Chromium fixtures checked both widths and themes, plus AZ and RU headers. Database and real Storage integration tests were skipped because the local test services were unavailable.

### Follow-up — mobile Products filters

- `ProductFilters.tsx` puts Status, Category, Purity and Clear filters in a mobile drawer. `ProductList.tsx` keeps search beside the Filters button on mobile and the inline toolbar on desktop. Filter changes still apply immediately and reset the cursor.
- Web TypeScript, changed-file lint and formatting, and nine targeted Vitest tests passed. Chromium fixtures covered 390px and 1280px in light and dark, including opening and closing the drawer, retaining search, submitting combined filters, clearing filters and avoiding horizontal page overflow.

## Task 20 — products overview, navigation and pagination (November 23, 2026)

- `apps/web/src/shared/ui/PageContainer.tsx` and `apps/web/src/index.css` provide fluid wide (1600px), standard and narrow layouts. `apps/web/src/app/Shell.tsx` keeps the store selector in the header, places the collapse control and Settings in the desktop sidebar, and exposes account actions through `AccountMenu.tsx` in the desktop footer and mobile More.
- `apps/web/src/features/products` reuses the market queries and adds a linked inventory overview and one scrolling filter row. `apps/api/src/modules/products` aggregates counts, exact available weight and Owner-mode acquisition values in the selected store. The credit count and filter both follow current outstanding balances, including multi-item sales and subsequent repayments.
- `CursorPagination.tsx` provides 10, 25, 50 and 100 rows and cursor history for Products, Sales, Customers, customer purchase history, Team members and pending invitations, and gold-rule history. The API retains the previous defaults for existing callers. No database migration is required.
- Contracts and API builds, web TypeScript and production build, changed-file lint, 23 contracts tests, 164 web tests and 71 API tests passed. The API suite used a disposable PostgreSQL database. Chromium fixtures checked 360, 390, 768, 1280, 1440, 1920 and 2560px in both themes, plus simulated safe areas, localization, account controls, cursor navigation and store switching. Physical devices, other browsers and real Storage remain unverified. Vite reported its existing chunk-size warning. Task branch is `task/20-products-navigation-pagination`.

### Follow-up — retail prices, filters and receipt customer

- Products shows the inventory overview. Its selling-price widget and widget-only translations were removed. Dashboard and checkout use the existing rate services.
- `ProductList.tsx` and `ProductFilters.tsx` align search and filters in one internally scrolling row. `SaleResult.tsx` links the current customer name beside the receipt date and payment status. The existing sale API includes the name for linked receipts and leaves anonymous receipts unchanged. No migration is required.
- Contracts and API builds, web typecheck and production build, changed-file lint and formatting, 15 targeted web tests and four API integration tests passed. Chromium fixtures checked Products and receipts at 360, 390, 768, 1280 and 1920px in both themes, with AZ and RU filter checks. Physical devices and other browsers remain unverified. Vite reported its existing chunk-size warning.

### Follow-up — automatic checkout pricing

- Sales options resolve active-purity retail rates in the sale currency. `SaleForm.tsx` and `item-pricing.ts` calculate an editable per-item suggestion from recorded net gold weight. An explicitly agreed final amount survives gram-rate changes and refetches. Where net and gross weights differ, checkout requires an explicit action to apply the metal-only suggestion.
- The existing sale request and receipt snapshot still store final agreed amounts. No schema migration was required. Contracts, API and web builds, changed-file lint, 27 targeted web tests and five PostgreSQL integration tests passed. Chromium fixtures covered 390px and 1280px in light and dark, independent sale items, refetches, resets and missing net weight.

## Task 19 — dashboard UX refinement (November 23, 2026)

- `apps/web/src/features/dashboard` now uses ordered, adaptive grid spans, compact financial rows and a quick-action toolbar. The unified sales chart remembers the selected metric per workspace and migrates saved amount/count widget preferences. Dashboard links open scoped Sales, Customers and Products filters or existing record details.
- `apps/api/src/modules/dashboard` returns decimal-safe comparisons against the same elapsed portion of the previous Asia/Baku day, with gross profit restricted to Owner mode. Sales and product list filters apply before pagination. Payment drill-down opens matching receipts and counts repayments separately from sales. See `docs/API_NOTES.md` for filter and baseline rules. This task requires no migration.
- `apps/web/src/features/workspace/WorkspaceProvider.tsx` shows a delayed, accessible accent spinner during initialization. `apps/web/src/index.css` centralizes light/dark scrollbar styles and preserves native forced-colors behavior.
- Contracts and application builds, TypeScript, changed-file lint, 23 contracts tests, 142 web tests and 71 API tests passed. The dashboard integration tests also passed after the final SQL and filter changes. The Vite build reported its existing chunk-size warning. Chromium fixtures covered 360px, 390px, 768px and 1280px in light and dark, including chart switching, scoped links, keyboard scrolling, workspace initialization, customization and role visibility. Azerbaijani and Russian also received narrow-screen checks. PostgreSQL integration used a disposable local database. Firefox, Safari, real-device and live Storage checks remain open. The changes are local on `task/19-dashboard-ux-refinement`.

### Follow-up — functional widget groups

- `apps/web/src/features/dashboard/preferences.ts` assigns existing widgets to Operations, Sales, Payments and Debt, Inventory and Intake, and Market Rates. The sections follow a fixed order. Saved widget visibility and order within each section carry forward, and group visibility uses the existing per-user, per-organization and per-store key.
- `DashboardPage.tsx` renders the adaptive grid in each nonempty group. `CustomizeDashboard.tsx` provides group disclosure and visibility controls alongside individual widget visibility, ordering and reset. Group visibility respects role restrictions.
- TypeScript, changed-file lint, 146 web tests and the production build passed. Chromium fixtures verified the grouped dashboard and customization at 390px and 1280px in both themes, including persistence, reset and salesperson restrictions. The follow-up remains local on the existing Task 19 branch.

### Follow-up — group ordering and adaptive packing

- `DashboardPage.tsx` renders Quick Actions directly below the header using its existing visibility preference. `CustomizeDashboard.tsx` previews group moves immediately and persists them on Apply. Reset restores the default group order. Legacy widget selections and the original storage key carry forward.
- `DashboardWidgetGrid.tsx` and `layout.ts` pack natural card heights on tablet and desktop while keeping saved reading and keyboard order. Recent Sales uses a compact span. Wide widgets can leave gaps that would require changing the saved order to fill. Mobile uses one column.
- TypeScript, changed-file lint, 151 web tests and the production build passed. Chromium fixtures verified Recent Sales and Inventory geometry at 390px, 768px and 1280px in both themes, including live breakpoint changes and delayed content. They also checked keyboard group moves, canceled previews, persistence across refresh and navigation, reset, and salesperson restrictions. The follow-up remains on the local Task 19 branch.

### Follow-up — shared layout and fixed widget priority

- `layout.ts`, `DashboardWidgetGrid.tsx`, and `dashboard-widget-grid.css` use the available group width, pair charts with nearby cards on roomy tablet layouts, and balance pairs of standard summaries on desktop. Compact cards keep their narrower spans. Packing uses observed card heights and keeps visual and keyboard order aligned.
- `preferences.ts` defines a fixed widget priority in each group. `CustomizeDashboard.tsx` keeps individual visibility controls and group reordering. Older visibility and group order carry forward under the same storage key, and old intra-group order is ignored.
- Changed-file lint, 154 web tests, TypeScript and the production build passed. Chromium fixtures covered all five groups at 390px, 768px and 1280px in both themes, including compact-only and mixed layouts, persisted settings, hidden groups, reset, and container resizing. Azerbaijani and Russian tablet fixtures and salesperson access also passed. The changes remain local and uncommitted.

### Follow-up — Quick Actions and mobile More

- `QuickActions.tsx` fits existing actions in one row using their rendered localized widths. Create Sale has first priority, and the ellipsis contains only actions that did not fit. Gold pricing remains owner-only.
- The Quick Actions and mobile More popups opt into the same content-sized shadcn menu styles in `responsive-menu.ts`. The bottom navigation keeps its existing placement, permissions and routes.
- TypeScript, changed-file lint, 159 web tests and the production build passed. Chromium fixtures checked 360px, 390px, 768px and 1280px in Azerbaijani, English and Russian in both themes, including live resizing, permission-dependent actions, touch opening and keyboard focus. Physical devices and nonzero notch insets remain unverified. Task 19 and its follow-ups are on `task/19-dashboard-ux-refinement`.

## Task 14 — operational dashboard (November 23, 2026)

- `apps/web/src/features/dashboard` provides the workspace landing page with configurable sales, payments, customer debt, intake, inventory, activity, quick actions, and market widgets. Products remains a separate route. Preferences are device-local per user, organization, and store. The existing display-mode switch clears sensitive query data.
- `apps/api/src/modules/dashboard` aggregates stored records on Asia/Baku day boundaries. The separate Owner-mode endpoint supplies gross profit and acquisition values. Gold history uses stored quotes and effective store rule versions. CBAR history accumulates published bulletins, with comparisons against the preceding stored bulletin.
- Migration `202611230003_dashboard_history` archives the cached CBAR bulletin and adds dashboard indexes. It passed schema parity on disposable PostgreSQL and was applied to the configured development database. Fastify smoke checks returned HTTP 200 for all nine new dashboard and market reads. Development has one archived CBAR bulletin, so multi-date sparklines require subsequent observations.
- Contracts build and 23 tests, web typecheck and 135 tests, API build and 70 tests, changed-file formatting and lint, and the web production build passed. Chromium fixtures covered 390px and 1280px in both themes, loading and retry, layout persistence, navigation, and display-mode restrictions. Live Storage and real-device checks remain open. Vite reported a chunk-size warning.
- Fixed a chart tooltip crash in `apps/web/src/components/ui/chart.tsx` and `apps/web/src/features/dashboard/components/DashboardCharts.tsx`. Tooltips preserve numeric timestamps and date formatting handles invalid values. All 137 frontend tests, the production build, and Chromium hover and keyboard checks passed.

## Color and mutation feedback follow-up (November 23, 2026)

- Shared Sonner and Alert components use semantic feedback colors. Checked controls and selected menu options use the brand accent. AGENTS.md and frontend conventions document color use across Misqal.
- Product photo upload uses shadcn Input, Empty, Alert and pending buttons while retaining the mobile camera and signed upload flow. Pending spinners stay visible on disabled actions and distinguish camera, file upload and Settings operations.
- Changed-file lint, 131 frontend tests and the production build passed. Browser and device checks for this follow-up remain open.

## Frontend standardization and rebranding (November 23, 2026)

- `apps/web/src/app/Shell.tsx` uses shadcn Sidebar on desktop and retains one bottom navigation on mobile. Official tabs, selects, form controls, tables, alerts and confirmations live in `apps/web/src/components/ui`. Shared pending buttons and skeletons use Spinner and Skeleton. The root Sonner toaster reports localized operation results and critical transaction feedback stays in the relevant form or dialog.
- `apps/web/src/shared/ui/BrandMark.tsx` renders the approved Misqal wordmark and compact variants. Browser titles, favicon and Apple Touch Icon use the Misqal brand. The accent token colors small selection indicators. The repository has no PWA manifest or service worker. Prior package, schema and storage identifiers are retained.
- Contracts build, frontend type checks, changed-file lint and formatting, 131 Vitest tests, and the production build passed. Translation keys match across AZ, EN and RU, including their respective plural categories. Chromium fixtures covered both themes at 390px and 1280px, including keyboard navigation, pending and failed mutations, confirmations, pricing and checkout, and repayment. Real-device and live-service checks remain open. Vite reported a chunk-size warning.

## Unified gold pricing (November 23, 2026)

- `apps/api/src/modules/gold-prices/store-pricing.service.ts` resolves independent store defaults and purity overrides for retail selling, scrap buying, and scrap selling. Resets append a history version. Relative rule saves check the preview revision and market quote. Product estimates and checkout use the same resolver.
- `apps/web/src/features/gold-prices` provides current rates, a previewed rule editor, and pricing history in Settings. Checkout suggestions use the selected purity and applicable CBAR conversion. Explicit agreed amounts remain editable when automatic rates change or become unavailable.
- Applied migration `202611230002_unified_gold_pricing` on disposable PostgreSQL and the confirmed hosted development database. It removed six obsolete rate records and preserved all 21 trade-in snapshots, related inventory and sale records, and compatible store rules. Prisma reports the development schema is current. Scoped pricing, history, Sales options, and trading Settings requests returned HTTP 200 against that database.
- Verified the API, web, database, and contracts suites. Chromium covered the Russian pricing views and checkout at 390px and 1280px in both themes. The live Storage integration test was skipped.
- The shared web formatter displays monetary amounts to two decimal places, including sale totals and trade-in prices. Calculations and stored values retain full precision. Web type checking, changed-file lint, and 131 web tests passed.

## Task 13 — market and store gold prices (November 23, 2026)

- Follow-up on `task/13-gold-prices`: active purities use the market selling rate unless an owner saved an override. Settings exposes selling rules and lets owners pick the default sale currency and accepted payment currencies. Checkout and the inventory exchange-rate widget use the selection. New buying rules await the lom qızıl workflow. Existing trade-in rates remain available.
- Applied `202611230001_payment_currencies` to development and verified Settings and workspace access against that database. Prisma schema parity, API and web type checks, changed-file lint, 65 API tests and 128 web tests passed. Chromium covered settings, rates and checkout at 390px and 1280px in both themes. Live Storage was skipped.

- `apps/api/src/modules/gold-prices` normalizes keyless Gold API XAU quotes with official CBAR USD/AZN and coordinates shared refreshes through PostgreSQL. The default schedules gold every 15 minutes and FX daily while Fastify runs. `docs/API_NOTES.md#gold-prices` records the provider terms, cache behavior and on-demand option for sleeping hosts.
- `apps/web/src/features/gold-prices` adds the market widget and owner-only buying and selling rules with fixed, percentage and offset modes. Product detail estimates use recorded net gold weight. AZN checkout suggests selling values and uses effective store buying rates with a legacy manual fallback. Sale and trade-in receipts use the amounts stored at completion. Market history and store rule history are exposed through scoped APIs.
- Applied `202611220004_gold_prices` and `202611220005_store_gold_pricing` to the configured development database. The scheduled live refresh persisted a Gold API quote with CBAR USD/AZN, and the market and owner settings endpoints returned HTTP 200. Prisma validation and schema parity, builds and type checks, changed-source lint and formatting, 65 API tests, 3 database tests, 23 contracts tests and 128 web tests passed. Chromium covered the dashboard, product values, pricing preview and save, and the stale state at 390px and 1280px in light and dark. The checkout browser check exercised prefill and manual edits. Live Storage was skipped. Workmanship, automatic suggestions in non-AZN checkout, and the historical dashboard chart remain separate work.

## Task 12 — automatic exchange rates (November 22, 2026)

- `apps/api/src/modules/exchange-rates` reads the Central Bank of Azerbaijan's current USD, EUR and TRY bulletin. The store-scoped endpoint lazily refreshes the shared PostgreSQL snapshot at most once every six hours and retains the last valid rates on failure. Provider and refresh details are in `docs/API_NOTES.md`.
- `apps/web/src/features/exchange-rates` shows the effective date and stale state on the Inventory landing page. Checkout and repayment suggest official rates and preview the AZN equivalent server-side. Payment records retain the rate submitted at checkout or repayment.
- Migration `202611220003_official_exchange_rates` is applied to the configured development database. Authenticated Fastify requests verified the live bulletin, persisted cache and payment conversion. Prisma schema parity, both app builds and type checks, changed-source lint and formatting, 51 API tests on fresh PostgreSQL, and 128 web tests passed. Chromium covered the widget, checkout and repayment at 390px and 1280px in both themes with API fixtures. The separate live Storage test was skipped.

## Task 11 — sale payments and customer debt (November 22, 2026)

- `apps/api/src/modules/sales` records split checkout payments with original tender, payment method, exchange rate and AZN equivalent. The calculated balance after trade-ins and monetary payments drives the customer requirement and confirmation. Repayments use the same conversion policy and a scoped idempotency key. They reduce the originating sale balance without creating sales revenue.
- `apps/web/src/features/sales` and `apps/web/src/features/customers` show settlement totals and offer repayment from sale and customer details. `apps/web/src/features/products` shows a localized sold-on-credit badge while the linked sale has debt. Products leave available inventory at checkout.
- Migration `202611220002_sale_debt` preserves historical tender, backfills linked balances and adds the payment ledger. Prisma validation, schema parity, historical backfill, TypeScript, changed-file formatting and lint, API and web builds, and 190 tests passed. Chromium checked checkout, confirmation, repayment replay after a lost response, and inventory badges at 390px and 1280px in light and dark. Live Storage testing was skipped.
- Applied the migration to the configured development database for manual testing. Prisma reports the schema is current. Read-only API checks returned HTTP 200 for an existing receipt, its product, sales history and the customer directory. The running local app is at `http://127.0.0.1:3000`.

## Task 10 — customers and sales (November 22, 2026)

- `apps/web/src/features/customers` and `apps/web/src/routes/customers.tsx` provide the searchable directory, contact management, AZN totals and purchase history with links to sales receipts. The sale form can select or create a contact and explicitly record an unpaid balance. Fully paid sales can stay anonymous.
- `apps/api/src/modules/customers` enforces store scope and Owner-mode deletion. Migration `202611220001_customers` adds store-scoped contacts and a restrictive sale relation. Totals come from stored sales and tender. Linked non-AZN sales capture an AZN reporting rate at checkout. Purchase history shows checkout tender. The API has no later debt collections, voids or cancellations.
- Type checks, changed-file lint and formatting, API and web builds, 23 contracts tests, 128 web tests and 34 API tests passed. Migrations and schema parity passed on disposable PostgreSQL. The live Storage test was skipped. Chromium fixtures covered the directory, purchase history and sale workflow at 390px and 1280px in light and dark.
- Customer creation and editing accept optional multiline notes. Notes appear in customer details. The hosted development database now has migration `202611220001_customers` and two labeled sample contacts in LE GOLD. Customer integration tests verified note creation and editing, and the development API returned both sample contacts and the saved note.
- Customer details use the same desktop side panel and mobile drawer as product details. Closing restores focus and preserves the directory search. Receipt links open the same panel. Chromium verified opening, editing notes, closing, and receipt links at 390px and 1280px in both themes.

## Development migration checks (November 22, 2026)

- Migration 202611200003_sale_items was initially pending on the hosted development database used by the local API. At follow-up Prisma found all eight migrations applied. Product details, sales history, and sale details returned HTTP 200 in Fastify injection checks using existing hosted development records and a test verifier.
- AGENTS.md now calls for checking migration status against the database used by the development API when a branch adds a migration. docs/LOCAL_SETUP.md records the PowerShell commands.

## Task 9 — sale confirmation and profit (November 20, 2026)

- Sales accept multiple products with individual final prices. The API checks each price against its acquisition cost before changing stock and issues an attempt-bound confirmation for losses. Active Owner mode sees the loss breakdown and receipt profit. Salesperson sessions receive a generic confirmation and receipts without profit data.
- `apps/api/src/modules/sales` records item acquisition snapshots and computes gross profit from the final sale value. Existing trade-in and payment settlement rules apply. Old receipts lack cost snapshots, and profit is unavailable when acquisition cost is missing or in another currency. Zero-value sales show the known loss with an unavailable margin.
- API and web builds, TypeScript, changed-file lint and formatting, 23 contracts tests, 124 web tests, and 30 API tests on disposable PostgreSQL passed. Chromium fixtures exercised both display modes at 390px and 1280px in light and dark. The separate live Storage test was skipped. Apply migration `202611200003_sale_items` before rolling out the updated API.

## Task 8 — owner display mode (November 20, 2026)

- The localized header control in `apps/web/src/features/settings/components/DisplayModeControl.tsx` switches the owner's current Supabase session to Salesperson mode. The API persists the restriction across token refresh and requires a fresh Supabase sign-in to regain Owner mode. Membership roles and separate device sessions retain their permissions.
- The server guard in `apps/api/src/modules/access/display-mode.ts` redacts stored acquisition costs and blocks owner settings, team administration, acquisition edits, and product deletion. Workspace permission flags hide the corresponding UI. Mode switches clear query caches and reload open tabs. Product intake still requires a new acquisition rate, and product search and sales remain available.
- Type checks, changed-file lint, API and web builds, disposable PostgreSQL integration tests, and live local Supabase browser checks passed. Chromium covered both modes at 390px and 1280px in light and dark, including wrong passwords, an interrupted switch, cross-tab changes, and direct API access with the previous session. The separate Storage test was skipped. Apply migration `202611200002_salesperson_display_session` before starting this API version.
- Applied the pending display-mode migration to the hosted development database used by the local API after the missing table caused a 500 during workspace loading. The same Prisma session lookup now succeeds.

## Task 7 — product acquisition and deletion (November 20, 2026)

- Product create and owner acquisition edit use a per-gram rate and preview weight × rate. The shared parser in `packages/contracts/src/products.ts` rounds the total half up to four places. The Prisma migration in `packages/database/prisma/migrations/202611200001_product_acquisition_per_gram` derives rates from valid legacy rows while preserving stored totals.
- Owner-only deletion in `apps/api/src/modules/products` requires confirmation in the web product detail and protects all sale and inventory history. Every API-created product has an intake movement. The schema has no archival mechanism.
- Type checks, changed-file lint, API and web builds, 23 contracts tests, 124 web tests, focused PostgreSQL product and sale tests, Prisma validation, and a legacy backfill check passed. Chromium fixtures covered create, edit, deletion and protected records at 390px and 1280px in both themes. The separate live Supabase Storage test was skipped.
- Applied the pending migration to the hosted database used by the local API after an unmigrated schema caused product details to return HTTP 500. Prisma reports the schema is current. A read-only check loaded an existing product with both acquisition amounts and verified the stored total against its backfilled rate.

## Azerbaijani timestamps (November 20, 2026)

- The shared formatter in `apps/web/src/shared/lib/format/index.ts` uses `DD.MM.YYYY HH:mm` for Azerbaijani to avoid browser month placeholders such as `M11`. All 108 web tests and the web build passed. Chromium fixtures verified the dates in product details, stock history, sale rows, and receipts at 390px and 1280px in both themes.

## Sales and inventory fixes (November 20, 2026)

- The cloud development project was missing `product-photos`. Created the documented private bucket with a 5 MiB limit and JPEG, PNG and WebP support. Signed upload, metadata, duplicate rejection and signed download passed with a disposable image that was removed after the check.
- In `apps/api/src/modules/sales/settlement.ts`, payment rejection now distinguishes underpayment from a trade-in that leaves nothing due. The sale form explains both cases and keeps field errors in place until the next submit. Products and sales use shared 24-hour timestamp formatting.
- The confirmed sale updates the affected store's cached product rows and detail before the exact refetches. Verified with 106 web tests, 7 focused API tests against disposable Postgres and local Storage, API and web builds, typecheck and lint. Chromium fixture checks passed at 390px and 1280px in light and dark, including a corrected payment and a Sold badge while the list refetch was delayed.

## Task 4 — sales (November 20, 2026)

- Added scoped sales history, search/date filters, cursor pagination and server receipts in `apps/web/src/features/sales` and `apps/web/src/routes/sales.tsx`. The in-stock product detail links to the sale form. `GET /sales/options` supplies the currency and current rates for active purities to both roles. Trading settings reads require an owner.
- Sale submission preserves its key and payload for retries and checks fresh product detail after an ambiguous response. It shows any existing receipt and refreshes the store's exact sales-list and inventory queries after a sale. The form sends decimal strings and renders amounts returned by the server.
- Contracts build, web build and typecheck, changed-file lint, and 102 web tests passed. Chromium checked history, details, creation and receipts at 390px and 1280px in light and dark with API fixtures. Fixtures covered repeated clicks, retry gating and key reuse, currency conflicts, and a committed sale with a lost response. Real-phone and live API retry checks remain open. A live settlement preview would require a backend endpoint.

## Task B1 — backend audit (November 20, 2026)

- [Backend audit](docs/BACKEND_AUDIT.md) refreshes the findings against `b407628`. The reviewed services enforce owner-only management, redact acquisition cost, and record a sale atomically using decimal arithmetic and scoped idempotency.
- Four settlement unit tests passed. Integration coverage was reviewed statically. Endpoint-specific denial and redaction assertions and a test requiring two matching successful responses to concurrent identical requests remain coverage gaps.

## Task 3 — products (November 20, 2026)

- Replaced the products placeholder with scoped search, facet filters, cursor pagination, a responsive detail panel, creation, and photo upload. The reference feature lives in `apps/web/src/features/products`; the route entry is `apps/web/src/routes/products.tsx`.
- Creation uses the contracts parser through a feature-local React Hook Form resolver because the shared resolver is absent. It defaults to the workspace currency and refreshes exact list and facet keys. Browser photos are downscaled to JPEG, sent by signed PUT, and confirmed before refreshing the detail.
- Contracts and web builds, web typecheck, changed-file lint and format, and 10 feature tests passed. Checked 390px and 1280px in light and dark with mocked API responses, including a duplicate code and a 1600px JPEG upload. Live signed storage, real-phone camera capture, and React DevTools review remain open.

## Task 2 — authentication and workspaces (November 20, 2026)

- Added Supabase email sign-in, signup, sign-out and password recovery in `apps/web/src/features/auth`. The API client replays a 401 once after refresh and preserves the session on retryable Auth outages. The web env uses the existing ignored `apps/web/.env.local` and the recovery route uses Supabase's allow-listed `/auth/callback`.
- Added onboarding, store access, per-account store selection, desktop and mobile switching and owner-only navigation in `apps/web/src/features/workspace` and `apps/web/src/app/Shell.tsx`. The emitted `/invitations/:token` link removes the token from the address bar before login and retains it in page memory until acceptance or dismissal.
- Verified against a separate local API and Supabase. Browser checks exercised signup, login, logout, guarded return paths, onboarding, simulated 401 and 503 responses, invitation acceptance and replay, role-based navigation, store switching and selection after reload, and Mailpit password recovery. Checked login and onboarding at 390px and 1280px in light and dark. Real-phone testing remains open.
- Contracts and web builds, web typecheck and lint, and 52 Vitest tests passed. The recovery check forwarded the Mailpit callback to the isolated Vite port.

## Task 1 — frontend foundation (November 20, 2026)

- Added `apps/web/src/app` providers, file routes, responsive shell, typed Azerbaijani/English resources, shared UI states and exact money/weight/purity formatters. API client in `src/shared/lib/api` supports injected bearer-token and unauthorized hooks; auth remains deferred.
- Preserved Radix Nova/Mist tokens, fonts, radius, Lucide and generated primitives in `src/components/ui`. No Mizan logo asset exists; `src/shared/ui/BrandMark.tsx` owns the text wordmark. `DESIGN.md` now documents the current foundation.
- Enabled React Compiler using the Vite 8 React plugin's Babel bridge, root ESLint Hooks rules, strict TypeScript, contracts workspace dependency and `/api` proxy. Vite reads VITE-prefixed variables from the root env directory. Existing scaffold zod/decimal.js dependencies were not added or used by this task.
- Verification: contracts build, web typecheck, lint, 37 shared-library tests and one production build passed. Browser access host was unavailable: 390px/1280px light/dark visual checks remain unverified. No backend changes, database operations, merge or deployment.
- Remaining: visual review; later auth/workspace and feature tasks. Branch `task/1-frontend-foundation` targets `main`.

## Task 0 — frontend API contract (November 19, 2026)

- Added `docs/API_NOTES.md` (under 150 lines) from current route/auth/error code, Prisma field types, Supabase configuration and shared-package public declarations. Backend code and dependencies are unchanged.
- Documents existing endpoints, decimal formats, bearer authentication, errors, validation and shared exports. `@mizan/contracts` has no Node/Prisma runtime dependency; `@mizan/database` remains backend-only.
- Findings: no CORS or API auth/session endpoints; inconsistent handling of non-AccessError failures; response/pagination details, owner enforcement, cost redaction, transactions and retry semantics delegated to business services remain unverified under the requested inspection scope. Direct Supabase Auth versus API-only auth needs a later decision.
- Documentation line count and Git whitespace checks verified. App, builds and tests intentionally not run for this documentation-only task. Branch: `task/0-api-notes`; PR targets `main`, with no merge/deployment authorized.

## Web scaffold (November 20, 2026)

- Removed the demo dashboard and restored the placeholder in `apps/web/src/App.tsx`. The Radix Nova/Mist preset and shadcn components remain in the web scaffold on `task/ui-component-updates`. Older frontend entries below describe the previous implementation.

- The Next.js frontend and design document were removed at the user’s request. The API, contracts, and database packages remain. API tests: 13 passed; 7 database integration tests skipped.

## Frontend design requirements

- Removed the previous icon library, palette, palette-switching, and glass-header requirements from active guidance in AGENTS.md, PROJECT_CONTEXT.md, and README.md. No frontend source remains to change.
- Frontend entries below and documents in docs/archive/ describe the removed implementation and are historical, not current visual requirements. A new visual direction remains to be approved.

## Current status

- Tasks 1–12 are merged into `main`. The first milestone handoff merged in PR #11.
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


- Start each new task from `main` on its own branch. Once verified, commit and push the branch and open a PR into `main`. Merging requires separate approval.
- Prisma owns the application schema and migrations. The private `mizan` schema stays outside the Supabase Data API's exposed schemas.
- Folders, files, and routes use English names. Language affects interface copy, and business names and defaults remain independent.

## Approved foundation

- Next.js web app, Fastify API, Prisma, and local Supabase services in a pnpm monorepo.
- SaaS-ready organization/store scoping with Owner and Salesperson roles.
- Email invitations, configurable permissions/purities/rates, multi-currency sales, old-gold trade-ins, and cash payouts are in the first milestone.
- The previous palette requirement has been retired.

## Important documents

- Roadmap: `docs/ROADMAP.md`

- Design: `docs/archive/first-milestone-spec.md`
- Plan: `docs/archive/first-milestone-plan.md`
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

Review the remaining Task 12 verification limits below before pilot use. Task 12 merged in PR #11.

## Management header

- Shared buttons use color feedback on hover and retain the press motion. The purchase-rate form starts with AZN selected and allows the owner to choose another currency.
- Onboarding, product, sales, and Settings currency dropdowns use options supplied by the web server. Sale previews also use server-supplied currency precision. Settings rate history renders its formatted dates on the server so differing browser ICU data does not cause hydration errors.

- `apps/web/components/shell/glass-header.tsx` stays 54 px tall on mobile and 60 px on desktop. `app-shell.tsx` tracks whether the page is scrolled, and `apps/web/app/globals.css` increases the glass background opacity from 44% to 64% with a 12 px backdrop blur. The mobile dock compacts independently.
- Management and public headers offer a compact flag dropdown. The mobile dock and drawer share the header glass. The web money formatter rounds display values to two decimal places while calculations and stored precision are preserved.
- Owner Settings use two independent columns at 1100 px and wider. Permissions and grades stack separately from rate entry and history in always-visible glass panels. Purity grades use divided rows, separate active and inactive badges, and different action styles. Reactivation restores the latest configured rate for that grade and currency, and existing rate and sale records retain their original values.
- `tests/e2e/first-milestone.spec.ts` covers stable height and the background change at 320 and 1440 px with reduced motion.

## Task 12

- `tests/e2e/first-milestone.spec.ts` and `playwright.config.ts` provide two real-service acceptance scenarios. They exercise owner registration/setup, settings, Mailpit invitation capture, new/existing account acceptance, hidden acquisition cost, revoked access, product persistence/search, invalid decimals, duplicate codes, ordinary sales, trade-in payouts, history, expired invitations, concurrent duplicate submissions, and already-sold items. SQL assertions verify exact persisted money, weights, rates, and single stock movements. `tsconfig.e2e.json` extends the root type check to the acceptance suite.
- The browser regression caught a confirmation-focus bug in `apps/web/features/sales/sale-form.tsx`. The native modal now keeps its trigger enabled while open, allowing Escape to restore focus. Native modal inertness, frozen review data, and the in-flight/idempotency guards continue protecting submissions.
- Verification on November 18, 2026 used Node 24 and a clean separate Supabase project, `mizan-task12`, on ports 55321–55325, with web/API on 3100/3101. No existing development database was reset. Workspace build, lint, type checking (including E2E), and 58 workspace tests passed. Three database schema tests passed. The separately configured live Storage suite passed both tests. Both Playwright scenarios passed, including the focus regression and exact financial assertions.
- Captures cover Products, Sales, New Sale, and Settings at 320, 375, 430, 768, 1024, and 1440 px with no document overflow and one main landmark. Keyboard checks cover confirmation Escape/return focus/reopening and history search. Azerbaijani Products was checked at 320 px under reduced motion. Desktop New Sale was compared with the historical desktop reference; the supported settlement fields and shipped navigation differ from the prototype's demo fields. Mobile has no exact approved frame in the inspected file. Screen-reader behavior, complete reduced-motion animation inspection, and email-confirmation-enabled signup remain unverified.
- `docs/LOCAL_SETUP.md`, `docs/BACKUP_RESTORE.md`, README links, and `.env.example` document setup, test configuration, service URLs, and recovery. A full local PostgreSQL custom archive and `/mnt` Storage file snapshot were created. The business schema restored into isolated PostgreSQL 17 after explicitly creating `mizan`. Documented representative SQL and all 14 table row hashes matched, including 33 organizations, 36 products, 22 sales, 9 trade-ins, and 59 movements. Real acceptance accounts had zero missing Auth identity links. These counts include retained integration fixtures and repeated acceptance runs.
- Private drill artifacts remain ignored under `.superpowers/task12/`. The 410,046-byte archive SHA-256 is `281169D323656F8F506B83F7EA5A3767B83A3BA0772BE3844ED912DDF0156965`. A full Supabase Auth/Storage restore and signed-photo access after that restore remain unverified. The documented recovery objective is at most 24 hours of data loss, requiring daily backups before pilot use.
- Changed-source formatting and `git diff --check` passed. Repository `pnpm format:check` reports 45 existing CRLF checkout files; their normalized contents match the base commit. Deferred minor items are routine `format:check` coverage for the new root/E2E files (checked explicitly here), and wrapping of English Sales status/action text at 1440 px. The owner's updated `AGENTS.md` instructions are included at their request. Task 12 is submitted in [PR #11](https://github.com/anarhabib/mizan-app/pull/11).

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

## App-wide design

- Existing routes now share `components/ui/page-heading.tsx`, light-glass panels, and grouped forms. `components/ui/form-controls.module.css` replaces the authentication-specific stylesheet. Workspace, settings, membership management, product creation/details, sale details, and public account pages use these patterns.
- `features/auth/auth-card.tsx` provides the public branded layout for sign-in, registration, setup, and invitations. The home page uses the wide public header, dark hero, shared brand geometry, and feature panels. Feature copy describes shipped inventory, photo, and settlement workflows. The authenticated shell owns one main landmark.
- Static review identified and corrected a mobile input font-size regression. Browser verification uses local fixtures, with captures for existing routes at 320 and 1890 px. Live account and settings mutations remain part of milestone end-to-end verification.
- The production web build with TypeScript checks, workspace lint, and all 18 web tests passed. Browser checks passed for desktop and mobile routes, sale flows, overflow, main landmarks, and the 16 px sign-in input baseline.

## Workflow efficiency

- AGENTS.md now prefers inline execution of approved milestone tasks, contextual reuse of unchanged material, focused iteration checks, and full relevant verification before completion. UI work checks the exact approved reference and existing components first.
- The roadmap covers the single-store pilot through SaaS. DESIGN.md and the existing UI provide the visual reference. The completed milestone plan and specification are archived in docs/archive/. Pilot verification is next.

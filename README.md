# Misqal

![misqal](apps/web/src/assets/branding/misqal-03-flat-ends-wordmark-mono-black.svg)

Misqal is a mobile-first business management platform for jewelry retailers, not a jewelry retailer. It helps store teams track individual pieces, gold weight and purity, acquisition costs, sales, old-gold trade-ins, and financial history. The interface is available in Azerbaijani, English, and Russian. `misqal.az` is the intended domain; registration, DNS, and deployment have not been verified.

## Current implementation

- Supabase Auth sign-in, registration, password recovery, workspace onboarding, store selection, and owner-managed staff invitations.
- Store-scoped jewelry inventory with search, filters, product details and history, optional private photos, and owner-controlled acquisition-cost visibility.
- Owner settings for purity grades and append-only old-gold purchase rates.
- Multi-item sales, old-gold trade-ins, payment settlement, server-calculated previews, receipts, and sales history.
- Localized owner and salesperson experiences with responsive mobile navigation and light/dark themes.

Returns, refunds, stock adjustments, customer records, barcode scanning, reports, and a public catalog are not implemented. See the [roadmap](docs/ROADMAP.md).

## Technology and workspace

| Area     | Current implementation                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Web      | Vite, React 19, TypeScript, TanStack Router and Query, Tailwind CSS v4, shadcn/Radix Nova/Mist, react-i18next |
| API      | Fastify REST API at `/api/v1`                                                                                 |
| Data     | Prisma and PostgreSQL; Supabase provides local PostgreSQL, Auth, private Storage, and development email       |
| Monorepo | pnpm workspaces: `apps/web`, `apps/api`, `packages/contracts`, `packages/database`                            |

The official 03 — Flat Ends brand assets are in [`apps/web/src/assets/branding`](apps/web/src/assets/branding). The implemented design and exact theme tokens are documented in [DESIGN.md](DESIGN.md). Start with [AGENTS.md](AGENTS.md) for development rules, [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for business rules, and [docs/FRONTEND.md](docs/FRONTEND.md) and [docs/API_NOTES.md](docs/API_NOTES.md) for implementation conventions and the API contract.

## Local development

1. Use Node.js 22.13 or later in the 22 release line, or Node.js 24, with pnpm 12.6.0 and Docker Desktop using Linux containers.
2. From the repository root, run `pnpm install --frozen-lockfile`.
3. Start local services with `pnpm supabase:start`. Supabase Studio is at http://127.0.0.1:54323; captured development email is at http://127.0.0.1:54324.
4. Configure API variables from `apps/api/.env.example` in `apps/api/.env`, and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `apps/web/.env.local`. See [`.env.example`](.env.example) and [local setup](docs/LOCAL_SETUP.md).
5. Run `pnpm dev` to start the Vite app at http://127.0.0.1:3000 and Fastify at http://127.0.0.1:3001. Check http://127.0.0.1:3001/api/v1/health.
6. Stop app processes with Ctrl+C, then run `pnpm supabase:stop` to retain local data while stopping Supabase.

Build `@mizan/contracts` before web tests or type checks: `pnpm --filter @mizan/contracts build`. Workspace checks are `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build`. The root format check excludes `apps/web` and Markdown files; check formatting for changed files in those locations separately. See [local setup](docs/LOCAL_SETUP.md) for integration tests, migrations, and service configuration.

## Data and compatibility

Keep `DATABASE_URL`, the Supabase service-role key, and other server-only credentials out of the browser. The browser uses Supabase Auth only; application data flows through the Fastify API. Product images use API-signed upload URLs.

The Prisma business tables use the private PostgreSQL schema `mizan`. The schema name, workspace packages (`@mizan/contracts`, `@mizan/database`), and `MIZAN_*` environment names are legacy internal identifiers intentionally retained for compatibility; they are not the customer-facing brand. Do not rename them as part of the rebrand.

Use the [backup and restore procedure](docs/BACKUP_RESTORE.md) before deliberate data recovery work. [PROJECT_STATE.md](PROJECT_STATE.md) records implementation and verification evidence. The [roadmap](docs/ROADMAP.md) distinguishes completed work from proposed milestones.

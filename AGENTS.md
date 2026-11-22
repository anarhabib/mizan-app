# Misqal — Copilot Agent Instructions

## Role and priorities

You assist the sole developer of Misqal, a mobile-first business management platform for jewelry retailers, not a jewelry retailer. Favor reliable, maintainable, straightforward implementations over abstraction. Work incrementally and preserve existing functionality and data. Keep tool and model usage lean without reducing correctness, security, or usability.

## Sources of truth

- `PROJECT_CONTEXT.md`: confirmed product scope, business rules, architecture, feature requirements. Read only the sections relevant to the task.
- `docs/API_NOTES.md`: backend contract (endpoints, auth, errors, number formats, pagination, idempotency). Frontend work reads this instead of backend code. If it looks stale or lacks detail, read only the one relevant backend file and update the note.
- `docs/FRONTEND.md`: frontend structure, API/auth, data, rendering and UI conventions. **Read before any UI task.**
- `DESIGN.md`: follow it only if its first line is `Status: current`. It records the implemented visual foundation and official brand asset usage; do not treat it as permission to change source tokens.
- Existing code, tests, Prisma schema and migrations: authoritative for the current implementation and database structure. Report consequential conflicts with approved requirements before changing behavior.
- `docs/ROADMAP.md`: milestone scope and sequencing. `PROJECT_STATE.md`: implementation and verification status.
- This file governs agent workflow. Do not invent requirements absent from approved sources.

## Stack (do not re-inspect)

- pnpm monorepo. Use pnpm only, never npm or yarn. Backend: Fastify + Prisma (`apps/api`, `/api/v1`). Frontend: `apps/web` (package name `web`).
- Frontend stack: Vite, React 19 with React Compiler, TypeScript, TanStack Router (file-based), TanStack Query, Tailwind CSS v4, shadcn/ui, react-i18next, react-hook-form, `@supabase/supabase-js` (Auth only), Vitest.
- Validation and decimal/money logic come from `@mizan/contracts` (plain types, parser functions, decimal helpers; no Zod). Do not add Zod or decimal.js unless a concrete need is shown and approved.
- Shared packages: `@mizan/contracts` is browser-safe; `apps/web` imports its types, parsers and helpers instead of redefining them. It must be built (`pnpm --filter @mizan/contracts build`) before web dev, tests or typecheck. `@mizan/database` (Prisma) is backend-only: never import it, or anything from `packages/database`, in `apps/web`.
- Auth and API: the API accepts `Authorization: Bearer <Supabase access token>` only (no cookies, no login endpoints, no CORS). Development uses a Vite proxy `/api` → `http://127.0.0.1:3001` with `VITE_API_BASE_URL=/api/v1`. There is no OpenAPI spec: write small typed API functions per feature using `@mizan/contracts` types.
- Supabase rule: the browser may use `supabase-js` for Auth only (sign-in, sign-up, session, refresh, password reset). Never use the Supabase Data API, Prisma, or Storage SDK from the frontend. Product photos go only to the signed `uploadUrl` returned by the API. Browser env contains only `VITE_SUPABASE_URL` and the publishable key, never the service-role key or database URL.
- Never read or search `.next/` or `node_modules/`.
- Read `package.json` only when adding or changing a dependency. Do not add dependencies, infrastructure or abstractions without demonstrated benefit.

## Development workflow

1. Define the requested change and inspect only the relevant code and docs. Reuse context already in the session.
2. Follow approved decisions and the milestone plan. For a well-scoped task, implement directly. Ask only about material unresolved decisions.
3. Prefer small, reviewable changes and shared components. No unrelated refactors or speculative features.
4. Add or update tests, especially for inventory, financial calculations, authentication and permissions.
5. Verification: run targeted checks while iterating; run one full relevant pass before completion (format, lint, type check, tests, build as applicable). Rerun only what later changes invalidated. Never skip financial, security, migration or data-integrity checks to save tokens. State what was and was not run.
6. For each task create a branch from current `main` (`task/<number>-<short-description>` for planned tasks). When verified, commit, push and open a PR to `main`. Do not merge, deploy or modify production data without explicit approval.
7. Report briefly: changed files/behavior, checks run, risks/unverified states, PR URL.

## Architecture

- Keep business logic out of presentation components and database access out of unrelated layers.
- Validate input at boundaries; return consistent, actionable errors.
- Use English for folder names, file names and route paths. User-facing text is Azerbaijani by default, with English and Russian support. Prioritize mobile-friendly workflows.
- Amounts are `{amount, currency}` objects. The organization default currency is usually AZN but other ISO currencies exist: never assume AZN, always display the currency code. Gold purity is an integer fineness (for example 585, 750), not a percentage. Weights are grams with up to 3 decimals. Never silently round, convert or reinterpret financial or weight values.
- Do not silently extend the MVP toward SaaS or multi-tenant functionality beyond what the API already provides.
- A public QR-shared catalog is planned for later as a separate app (`apps/catalog`, server-rendered or static for fast first load and link previews). It is out of scope now: do not add public routes, SSR or catalog code to `apps/web`. When it is built, public endpoints must use separate response shapes that never expose cost price, supplier, exact stock counts or internal notes, and must be rate-limited and cacheable.

## Data integrity and security

- Treat each jewelry item and inventory movement as business-critical data.
- Sales, trade-ins and stock changes must keep records consistent and prevent duplicate or invalid inventory movements.
- Use database transactions for multi-step operations that must succeed or fail together.
- Use decimal-safe arithmetic for money and weights, never floating point.
- Do not delete or overwrite historical inventory or financial records as a shortcut; follow documented audit/correction rules.
- Never reset a database, make destructive schema changes or apply production migrations without explicit approval.
- Keep secrets out of code, docs and logs. Use environment variables and keep `.env.example` free of credentials. Never log or persist invitation tokens or access tokens outside the Supabase session store.
- Enforce permissions server-side, not only by hiding UI controls.

## Frontend (summary; details in `docs/FRONTEND.md`)

- Preserve the current feature-based UI, shadcn primitives and Radix Nova/Mist foundation. Server state only in TanStack Query; Tailwind for styling. The preset (`components.json`), exact theme tokens (`src/index.css`), fonts, radius, and icon library are authoritative: do not replace or restyle them. The official 03 — Flat Ends SVGs live in `apps/web/src/assets/branding`; render the light/dark wordmark only through `shared/ui/BrandMark` and use the supplied application icon for favicon configuration. Do not redraw, recolor, or distort the assets. Their lime is brand-only, not an application accent. Keep `src/index.css` unchanged for branding work.
- Mobile-first, compact on desktop. No unnecessary re-renders.
- Every store-scoped API call carries `organizationId` and `storeId`; both belong in every query key.
- Money and weights stay as decimal strings in the UI; never use `parseFloat` or Number for them. Display server-calculated values; do not compute money in the UI.
- Sales and any stock- or money-changing action are never optimistic. Disable submit while pending and invalidate exact query keys on success. `POST /sales` always sends an `Idempotency-Key`.
- Preserve keyboard navigation, accessible names, focus visibility, contrast, reduced motion and usable mobile controls.
- User-facing identity is Misqal; preserve legacy internal identifiers such as `mizan`, `@mizan/*`, and `MIZAN_*` for compatibility unless a separate migration is approved.
- Visual check only when the task asks for it, or once before a UI PR: one pass at 390px and 1280px. Report deliberate deviations and unverified states.

## Execution efficiency

- Work inline in the session. Use subagents only for substantial independent work or high-risk review, giving them focused requirements, changed files and the diff, not the whole conversation.
- Reuse approved plans and decisions. Do not reopen resolved scope, repeat questions, or write new plans or documents for routine tasks.
- Read the smallest relevant sections; do not re-read unchanged files. Batch independent reads and searches and constrain output to relevant findings and errors.
- Do not run repeated full-repo scans, repeated builds after small visual changes, screenshots, or web browsing unless the task needs them.
- Do not reinstall or rewrite shadcn components; the developer adds them with the CLI.
- Use `pnpm dlx modern-web-guidance retrieve <id>` only for CSS, layout, color, motion, performance or accessibility topics, and only for guide IDs named in the task (at most 3). Never search or list guides. The CLI saves each guide to a temp file and prints its path: read it once with the file-reading tool (not cat or head), never re-read it. Use shadcn components for overlays, menus, toasts and form controls, not native-API guides for those.
- Use Windows-compatible PowerShell commands and literal paths; run dependent commands sequentially and check exit codes.
- Do not claim measured token savings without actual usage data.

## Communication and session continuity

- Ask focused questions only when the answer materially affects behavior, security, data, architecture or approved visual direction. Distinguish confirmed facts from assumptions and explain consequential risks.
- On a new session, read only documentation relevant to the task; do not assume earlier chat context persists. Check `TASKS.md` if present. When a task finishes, tick only the boxes for items you implemented and verified, in the same PR. Leave manual-test boxes (real phone, React DevTools profiler, slow-network or double-tap tests) unticked and list them in the PR description as "needs developer check". Do not add, remove or reword tasks.
- Record significant approved decisions in an existing appropriate document; use `DECISIONS.md` only if the repository has adopted it.

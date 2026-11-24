Misqal — Codex Agent Instructions
Role and priorities
You assist the sole developer of Misqal, a jewelry-store inventory and sales management application. Favor reliable, maintainable, straightforward implementations over abstraction. Work incrementally and preserve existing functionality and data. Keep tool and model usage lean without reducing correctness, security, or usability.
Sources of truth
- PROJECT_CONTEXT.md: confirmed product scope, business rules, architecture, feature requirements. Read only the sections relevant to the task.
- docs/API_NOTES.md: backend contract (endpoints, auth, errors, number formats, pagination, idempotency). Frontend work reads this instead of backend code. If it looks stale or lacks detail, read only the one relevant backend file and update the note.
- docs/FRONTEND.md: frontend structure, API/auth, data, rendering and UI conventions. Read before any UI task.
- DESIGN.md: follow it only if its first line is Status: current. Otherwise it is outdated (pre-rebuild): ignore it.
- Existing code, tests, Prisma schema and migrations: authoritative for the current implementation and database structure. Report consequential conflicts with approved requirements before changing behavior.
- docs/ROADMAP.md: milestone scope and sequencing. PROJECT_STATE.md: implementation and verification status.
- This file governs agent workflow. Do not invent requirements absent from approved sources.
Stack (do not re-inspect)
- pnpm monorepo. Use pnpm only, never npm or yarn. Backend: Fastify + Prisma (apps/api, /api/v1). Frontend: apps/web (package name web).
- Frontend stack: Vite, React 19 with React Compiler, TypeScript, TanStack Router (file-based), TanStack Query, Tailwind CSS v4, shadcn/ui, react-i18next, react-hook-form, @supabase/supabase-js (Auth only), Vitest.
- Validation and decimal/money logic come from @mizan/contracts (plain types, parser functions, decimal helpers; no Zod). Do not add Zod or decimal.js unless a concrete need is shown and approved.
- Shared packages: @mizan/contracts is browser-safe; apps/web imports its types, parsers and helpers instead of redefining them. It must be built (pnpm --filter @mizan/contracts build) before web dev, tests or typecheck. @mizan/database (Prisma) is backend-only: never import it, or anything from packages/database, in apps/web.
- Auth and API: the API accepts Authorization: Bearer <Supabase access token> only (no cookies, no login endpoints, no CORS). Development uses a Vite proxy /api → http://127.0.0.1:3001 with VITE_API_BASE_URL=/api/v1. There is no OpenAPI spec: write small typed API functions per feature using @mizan/contracts types.
- Supabase rule: the browser may use supabase-js for Auth only (sign-in, sign-up, session, refresh, password reset). Never use the Supabase Data API, Prisma, or Storage SDK from the frontend. Product photos go only to the signed uploadUrl returned by the API. Browser env contains only VITE_SUPABASE_URL and the publishable key, never the service-role key or database URL.
- Never read or search .next/ or node_modules/.
- Read package.json only when adding or changing a dependency. Do not introduce new dependencies, paid external services, infrastructure or abstractions without concrete justification and any required approval.
Development workflow
1. Start from the latest main after all dependent tasks have been reviewed and merged. Verify prerequisites before implementation; do not merge dependent PRs yourself. Create a task branch (task/<number>-<short-description> for planned tasks).
2. Define the requested change using approved decisions and milestone scope. Inspect only relevant files and documentation sections; reuse session context. Implement well-scoped tasks directly and ask only about material unresolved decisions.
3. Keep changes incremental, narrowly scoped and reviewable. Reuse existing components, services, schemas and dependencies before introducing new ones. Do not perform unrelated refactoring, redesign or speculative work. Change the backend only when required for functionality, authorization or data integrity.
4. Add or update relevant tests, especially for inventory, financial calculations, authentication and permissions. If a non-critical requirement is blocked, complete the remaining independent scope and report the blocker; never bypass critical safeguards.
5. Run targeted checks during implementation and one final relevant verification pass before committing (format, lint, typecheck, tests and build as applicable). Do not rerun successful commands unless relevant files or inputs changed. Never skip financial, security, migration or data-integrity checks to save tokens. State what was and was not run.
6. Update only affected documentation sections and verified task status. When verification is complete, commit, push and open a PR to main. Do not merge the PR. Do not deploy or modify production data without explicit approval.
7. Keep the final report concise: implemented changes, migrations (if any), tests and verification results, known limitations or blockers, and PR URL. Never invent a PR URL or claim verification that was not performed.
When a branch adds a Prisma migration, check migration status against the database used by the running development API before declaring the task ready for local testing. Use the API's effective environment, as shown in [Local setup](docs/LOCAL_SETUP.md#check-the-schema-used-by-the-running-api). After applying a pending migration to a confirmed development database, verify an affected API request there. The health endpoint and disposable database tests validate different environments.
Architecture
- Keep business logic out of presentation components and database access out of unrelated layers.
- Validate input at boundaries; return consistent, actionable errors.
- Use English for folder names, file names and route paths. User-facing text is Azerbaijani by default, with English and Russian support. Prioritize mobile-friendly workflows.
- Amounts are {amount, currency} objects. The organization default currency is usually AZN but other ISO currencies exist: never assume AZN, always display the currency code. Gold purity is an integer fineness (for example 585, 750), not a percentage. Weights are grams with up to 3 decimals. Never silently round, convert or reinterpret financial or weight values.
- Do not silently extend the MVP toward SaaS or multi-tenant functionality beyond what the API already provides.
- A public QR-shared catalog is planned for later as a separate app (apps/catalog, server-rendered or static for fast first load and link previews). It is out of scope now: do not add public routes, SSR or catalog code to apps/web. When it is built, public endpoints must use separate response shapes that never expose cost price, supplier, exact stock counts or internal notes, and must be rate-limited and cacheable.
Data integrity and security
- Treat each jewelry item and inventory movement as business-critical data.
- Sales, trade-ins and stock changes must keep records consistent and prevent duplicate or invalid inventory movements.
- Use database transactions for multi-step operations that must succeed or fail together.
- Use decimal-safe arithmetic for money and weights, never floating point.
- Do not delete or overwrite historical inventory or financial records as a shortcut; follow documented audit/correction rules.
- Generate migrations that preserve existing data; never reset a database or delete existing data to make a migration succeed. Never execute destructive migrations against production. Do not apply production migrations without explicit approval.
- Keep secrets out of code, docs and logs. Use environment variables and keep .env.example free of credentials. Never log or persist invitation tokens or access tokens outside the Supabase session store.
- Enforce permissions server-side, not only by hiding UI controls.
Frontend (summary; details in docs/FRONTEND.md)
- The UI was rebuilt from scratch. Do not recreate old components, palettes, glass headers or the previous icon library.
- Feature-based structure. Server state only in TanStack Query. Tailwind for styling. Preserve the applied shadcn preset, theme variables, typography, radius and icon library.
- Check installed shadcn components before creating interactive UI. Compose official primitives, use native HTML for semantic structure, and delete replaced implementations. Use Sonner for operation feedback, Skeleton for initial loading, Spinner for pending actions, and Progress when the operation reports meaningful progress.
- Mobile-first, compact on desktop. No unnecessary re-renders.
- Every store-scoped API call carries organizationId and storeId; both belong in every query key.
- Money and weights stay as decimal strings in the UI; never use parseFloat or Number for them. Display server-calculated values; do not compute money in the UI.
- Sales and any stock- or money-changing action are never optimistic. Disable submit while pending and invalidate exact query keys on success. POST /sales always sends an Idempotency-Key.
- Preserve keyboard navigation, accessible names, focus visibility, contrast, reduced motion and usable mobile controls.
- For new or changed forms, follow the Mobile forms section in DESIGN.md. Reuse ProductPanel, Input and the applicable existing picker. Verify at 320px and 390px, and confirm the desktop sheet at 1280px when applicable. Check scrolling, focus, form actions, searchable selection and date bounds as applicable. Reuse the browser regression checks in `apps/web/tests/mobile-forms`. Report physical iOS and Android keyboard, safe-area and date-picker checks separately.
- Visual check only when the task asks for it, or once before a UI PR: one pass at 390px and 1280px. Report deliberate deviations and unverified states.
Branding
- Approved brand assets are located in `src/assets/branding` under `apps/web`.
- Use `BrandMark` as the centralized branding component.
- Never recreate or duplicate approved logos.
- Use the brand accent selectively in small UI details.
- Preserve neutral application surfaces and semantic status colors.
- Use color intentionally across components and pages. Use semantic success, warning, danger and informational colors for feedback, and the brand accent for small selection details. Pair color with text, an icon or a programmatic state.
- Never hardcode brand colors inside feature components.
- Preserve light/dark theme compatibility.
Execution efficiency
- Work inline in the session. Use subagents only for substantial independent work or high-risk review, giving them focused requirements, changed files and the diff, not the whole conversation.
- Reuse approved plans and decisions. Do not reopen resolved scope, repeat questions, or write new plans or documents for routine tasks.
- Read the smallest relevant sections; do not re-read unchanged files. Batch independent reads and searches and constrain output to relevant findings and errors.
- Do not run repeated full-repo scans, repeated builds after small visual changes, screenshots, or web browsing unless the task needs them.
- Install missing official components with `pnpm dlx shadcn@latest add <component> --cwd apps/web` when authorized. Preserve installed and customized primitives.
- Use pnpm dlx modern-web-guidance retrieve <id> only for CSS, layout, color, motion, performance or accessibility topics, and only for guide IDs named in the task (at most 3). Never search or list guides. The CLI saves each guide to a temp file and prints its path: read it once with the file-reading tool (not cat or head), never re-read it. Use shadcn components for overlays, menus, toasts and form controls, not native-API guides for those.
- Use Windows-compatible PowerShell commands and literal paths; run dependent commands sequentially and check exit codes.
- Do not claim measured token savings without actual usage data.
Communication and session continuity
- Ask focused questions only when the answer materially affects behavior, security, data, architecture or approved visual direction. Distinguish confirmed facts from assumptions and explain consequential risks.
- On a new session, read only documentation relevant to the task; do not assume earlier chat context persists. Check TASKS.md if present. When a task finishes, tick only the boxes for items you implemented and verified, in the same PR. Leave manual-test boxes (real phone, React DevTools profiler, slow-network or double-tap tests) unticked and list them in the PR description as "needs developer check". Do not add, remove or reword tasks.
- Record significant approved decisions in an existing appropriate document; use DECISIONS.md only if the repository has adopted it.

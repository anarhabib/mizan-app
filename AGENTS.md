# Mizan — Codex Agent Instructions

## Role and priorities
You assist the sole developer of Mizan, a jewelry-store inventory and sales management application. Favor reliable, maintainable, straightforward implementations over abstraction. Work incrementally and preserve existing functionality and data. Keep tool and model usage lean without reducing correctness, security, or usability.

## Sources of truth
- `PROJECT_CONTEXT.md`: confirmed product scope, business rules, architecture, feature requirements. Read only the sections relevant to the task.
- `docs/API_NOTES.md`: compact backend contract (endpoints, auth, error format, decimal formats, validation). Frontend work reads this instead of backend code. If it looks stale or lacks an endpoint, read only that backend route file and update the note.
- `docs/FRONTEND.md`: frontend structure, data, rendering and UI conventions. **Read before any UI task.**
- `DESIGN.md`: follow it only if its first line is `Status: current`. Otherwise it is outdated (pre-rebuild): ignore it.
- Existing code, tests, Prisma schema and migrations: authoritative for the current implementation and database structure. Report consequential conflicts with approved requirements before changing behavior.
- `docs/ROADMAP.md`: milestone scope and sequencing. `PROJECT_STATE.md`: implementation and verification status.
- This file governs agent workflow. Do not invent requirements absent from approved sources.

## Stack (do not re-inspect)
- pnpm monorepo. Use pnpm only, never npm or yarn. Backend: Fastify + Prisma. Frontend: `apps/web` (package name `web`).
- Frontend stack: Vite, React 19 with React Compiler, TypeScript, TanStack Router (file-based), TanStack Query, Tailwind CSS v4, shadcn/ui, react-i18next, react-hook-form + Zod, decimal.js, Vitest.
- Never read or search `.next/` or `node_modules/`.
- Backend input validation: check how existing routes validate (Fastify's built-in JSON Schema counts) before proposing anything. Do not add a validation library to the backend without approval.
- Read `package.json` only when adding or changing a dependency.
- Do not add dependencies, infrastructure or abstractions without demonstrated benefit.

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
- Use English for folder names, file names and route paths. User-facing text is Azerbaijani by default, with English support. Prioritize mobile-friendly workflows.
- Currency is AZN. Always show explicit units (grams, gold purity, etc.). Never silently round, convert or reinterpret financial or weight values.
- Do not silently extend the MVP toward SaaS or multi-tenant functionality.
- A public QR-shared catalog is planned for later as a separate app (`apps/catalog`, server-rendered or static for fast first load and link previews). It is out of scope now: do not add public routes, SSR or catalog code to `apps/web`. When it is built, public endpoints must use separate response shapes that never expose cost price, supplier, exact stock counts or internal notes, and must be rate-limited and cacheable.

## Data integrity and security
- Treat each jewelry item and inventory movement as business-critical data.
- Sales, returns, old-gold exchanges and stock adjustments must keep records consistent and prevent duplicate or invalid inventory movements.
- Use database transactions for multi-step operations that must succeed or fail together.
- Use decimal-safe arithmetic for money and weights, never floating point.
- Do not delete or overwrite historical inventory or financial records as a shortcut; follow documented audit/correction rules.
- Never reset a database, make destructive schema changes or apply production migrations without explicit approval.
- Keep secrets out of code, docs and logs. Use environment variables and keep `.env.example` free of credentials.
- Enforce permissions server-side, not only by hiding UI controls.

## Frontend (summary; details in `docs/FRONTEND.md`)
- The UI was rebuilt from scratch. Do not recreate old components, palettes, glass headers or the previous icon library.
- Feature-based structure. Server state only in TanStack Query. shadcn/ui for primitives. Tailwind for styling. Branding is provisional: the logo lives only in `shared/ui/BrandMark` and the accent color only in the `--primary` token, so a rebrand is a one-file change. Never hardcode brand colors in components; use semantic tokens.
- Mobile-first, compact on desktop. No unnecessary re-renders.
- Money and weights stay as decimal strings in the UI; never use `parseFloat` for them.
- Sales, returns, old-gold exchanges and stock adjustments are never optimistic. Disable submit while pending and invalidate exact query keys on success.
- Preserve keyboard navigation, accessible names, focus visibility, contrast, reduced motion and usable mobile controls.
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
- On a new session, read only documentation relevant to the task; do not assume earlier chat context persists. Check `TASKS.md` if present and update it only when task status changes.
- Record significant approved decisions in an existing appropriate document; use `DECISIONS.md` only if the repository has adopted it.
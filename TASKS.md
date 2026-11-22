# Misqal — Tasks

Status synchronized against the current implementation. Change a checkbox only when implementation and required verification are complete.
Prompts referenced below are in `docs/CODEX_PROMPTS.md`.

## Done

- [x] Remove old frontend styles and source
- [x] Write `AGENTS.md`, `docs/FRONTEND.md`, `docs/CODEX_PROMPTS.md`
- [x] Scaffold `apps/web` (Vite, React, TypeScript, Tailwind v4, shadcn)
- [x] Apply shadcn preset
- [x] Backend contract notes (`docs/API_NOTES.md`)

## Foundation implementation

- [x] Prompt 1: frontend foundation (Codex running)
  - [x] Review PR: only `apps/web`, docs and `.env.example` changed; nothing in `apps/api` or `packages`
  - [x] Shell looks right at 390px and 1280px, light and dark
  - [x] Accent color comes from the preset, no extra colors
  - [x] `DESIGN.md` starts with `Status: current`
  - [x] Read Codex's open questions, then merge

## Frontend sequence

- [x] Add before Prompt 2: `pnpm --filter web add @supabase/supabase-js`, create `apps/web/.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; publishable key only)
- [x] Prompt 2: auth, workspace, onboarding, invitation accept
  - [ ] Test login, logout, onboarding, store switch, expired session on a phone
- [ ] Add before Prompt 3: `pnpm dlx shadcn@latest add select textarea alert-dialog switch tabs`
- [x] Prompt 3: products (reference feature)
  - [ ] Check re-renders with React DevTools "highlight updates"
  - [ ] Test photo upload from a real phone camera
  - [ ] Fix anything wrong now, every later feature copies this one
- [x] Prompt 4: sales (needs the backend audit below first)
  - [ ] Test double tap, slow network and retry: only one sale must exist
- [x] Prompt 5: settings (owner)
- [x] Prompt 6: team (owner)

## Backend (parallel, does not block Prompts 1 to 3)

- [x] Read-only audit (`docs/BACKEND_AUDIT.md`): owner-only enforcement, acquisition-cost hiding, sale transaction, idempotency replay, float arithmetic, test coverage
- [ ] Fix serious audit findings before Prompt 4
- [ ] Return 400/404 in `{code,message}` shape for malformed JSON and unknown routes (not 500)
- [ ] Validate route params (UUID ids) on membership and settings routes
- [ ] Confirm the invitation email link opens the web accept-invitation route (Supabase site URL and template)
- [ ] Confirm which Supabase sign-in methods are enabled and match the login page

## Before production

- [ ] Decide hosting: same origin for web and `/api` behind one proxy, or add `@fastify/cors` with an allow-list
- [ ] Production Supabase project: URL, publishable key, redirect URLs, SMTP for invitations
- [ ] Environment variables set, no service-role key or database URL in the browser build
- [ ] Backup and restore tested (`docs/BACKUP_RESTORE.md`)
- [ ] Run the full check pass: format, lint, typecheck, tests, build
- [ ] Test on a real phone on shop Wi-Fi

## Product decisions to make

- [x] Do you need a live trade-in value preview before submitting a sale? (needs a backend `POST /sales/preview`)
- [ ] Which are needed: returns, refunds, stock adjustments, customers, reports? (none exist in the API yet; each is a backend task, then a frontend prompt)
- [ ] Add typed responses for `/sales/options`, settings and membership actions to `@mizan/contracts`
- [x] Final brand: logo SVG and accent color (one file and one token)
- [ ] Installable PWA for the shop phones?

## Later

- [ ] Public QR catalog as a separate app (`apps/catalog`, server-rendered or static, separate public response shapes, rate limited)
- [ ] Barcode or camera scanning for stock items

## Routine

- [ ] After each merged feature: update `PROJECT_STATE.md`
- [ ] If a new convention appears, add it to `docs/FRONTEND.md` in at most 3 lines
- [ ] One new Codex session per prompt, merge each PR yourself after testing

# Mizan project state

## Current status

- Tasks 1–6 are on `main`. Task 7 is implemented on `task/7-design-foundation`.
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

- The developer opens a fresh chat for each new task after the previous PR merges. Verify the merge and sync local `main` with `origin/main` before creating the next task branch. Once verified, commit and push the branch and open a PR into `main`. Merging requires separate approval.
- Prisma owns the application schema and migrations. The private `mizan` schema stays outside the Supabase Data API's exposed schemas.
- Folders, files, and routes use English names. Language affects interface copy, and business names and defaults remain independent.

## Approved foundation

- Next.js web app, Fastify API, Prisma, and local Supabase services in a pnpm monorepo.
- SaaS-ready organization/store scoping with Owner and Salesperson roles.
- Email invitations, configurable permissions/purities/rates, multi-currency sales, old-gold trade-ins, and cash payouts are in the first milestone.
- Zümrüd is the only initial palette.

## Important documents

- Design: `docs/superpowers/specs/2026-11-17-mizan-first-milestone-design.md`
- Plan: `docs/superpowers/plans/2026-11-17-mizan-first-milestone.md`
- Product context: `PROJECT_CONTEXT.md`
- Visual system: `DESIGN.md`

## Tasks 6–7

- Task 6 added owner-only trading settings at `/settings`, including acquisition-cost visibility, purity management, and append-only purchase rates.
- Task 7 adds the Tailwind Zümrüd tokens in `apps/web/app/globals.css`, the shared brand and controls in `apps/web/components`, and the authenticated layout in `apps/web/app/(app)/layout.tsx`. Navigation exposes workspace and the shipped owner settings pages. Store selection and authorization continue to use API-validated contexts.
- `apps/web/app/(auth)/sign-in/page.tsx` uses the existing Supabase password flow and adds localized validation feedback and password visibility. Browser checks use local Auth and API fixtures. Live sign-in and settings mutations were outside those checks.
- Task 7 passed 10 web tests, lint, web type checking, the production web build, and formatting for changed web files. The browser checks covered workspace and settings at 320, 375, 430, 768, 1024, and 1440 px, including mobile scroll compaction, Escape dismissal, and focus restoration. Repository-wide formatting still flags 19 pre-existing files.

## Next step

Review [Task 7 PR #2](https://github.com/anarhabib/mizan-app/pull/2). After it merges, start Task 8 in a fresh chat from updated `main`. Task 8 adds the product and inventory API.

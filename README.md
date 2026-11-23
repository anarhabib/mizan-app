# Misqal

Misqal is an inventory and sales app for jewelry stores, available in Azerbaijani, English, and Russian. The workspace has a Vite and React web app, a Fastify API, and separate packages for API contracts and the database. The intended public domain is `misqal.az`.

Follow [the local setup guide](docs/LOCAL_SETUP.md) for environment configuration, migrations, service addresses, and verification commands. Use [the backup and restore procedure](docs/BACKUP_RESTORE.md) to preserve local data and exercise isolated recovery. See the [roadmap](docs/ROADMAP.md) for upcoming milestones. Current milestone acceptance evidence is in [PROJECT_STATE.md](PROJECT_STATE.md).

## Local development

1. Use Node.js 22.13 or later in the 22 line, or Node.js 24, with pnpm 12.6.0. Start Docker Desktop for database, authentication, storage, and local email.
2. Run `pnpm install --frozen-lockfile` in this directory.
3. Run `pnpm supabase:start` to start local Supabase. The first startup downloads Docker images. Supabase Studio is at http://127.0.0.1:54323 and its captured development emails are at http://127.0.0.1:54324. [Supabase local development guide](https://supabase.com/docs/guides/local-development/cli/getting-started)
4. Run `pnpm dev` to start the web app at http://127.0.0.1:3000 and the API at http://127.0.0.1:3001. Open http://127.0.0.1:3001/api/v1/health to check that the API process responds.
5. Stop the app processes with Ctrl+C and run `pnpm supabase:stop` to stop Supabase while retaining development data.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build` from the workspace root to verify changes.

The frontend uses the existing shadcn/ui preset and Tailwind CSS. See [frontend conventions](docs/FRONTEND.md) for component and brand asset usage.

## Database changes

With local Supabase running, set `DATABASE_URL` in your shell to the local PostgreSQL connection string reported by the Supabase CLI. Keep this value server-side. Application tables use the private `mizan` PostgreSQL schema.

Check the published port bindings with `docker ps` before leaving Supabase running. On this Windows Docker Desktop setup, the local CLI published ports on all interfaces even with a loopback-configured bridge. Stop Supabase after testing until the bindings are restricted to this PC.

```powershell
pnpm --filter @mizan/database run generate
pnpm --filter @mizan/database run migrate
pnpm --filter @mizan/database run test:integration
```

Generate Prisma Client after a fresh install or a schema edit, before running workspace type checks. The database integration tests require a local connection and roll back their fixtures.

## API access checks

Set `DATABASE_URL` and `SUPABASE_URL` in the API process environment to enable access checks. Use the Supabase origin that matches the access token's issuer. For a project using legacy HS256 signing, also set `SUPABASE_PUBLISHABLE_KEY` to the project's publishable or local anon key. Never use a service-role key for verification.

`GET /api/v1/organizations/:organizationId/stores/:storeId/access` accepts a Supabase user token using `Authorization: Bearer <token>`. An allowed request returns the user's ID, scoped role, and organization settings. Missing or invalid credentials return 401. An unavailable or unassigned store returns the same 403 response, including when an existing assignment or membership has been deactivated. The route returns 503 when the API is started without authentication configuration.

To include API access, onboarding, invitation, settings, and product integration tests, apply the migrations to a disposable local test database, run `pnpm build`, and set `MIZAN_TEST_DATABASE_URL` in the shell before running `pnpm test`. These tests can leave fixtures in that disposable database.

## Owner signup and language

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `apps/web/.env.local`. Point the API to the same Supabase project and apply the Prisma migrations before starting the apps. See `.env.example` for the expected variables.
2. Open http://127.0.0.1:3000/login. Create an account or sign in. If you have no store assignments, enter an organization name, a store name, and a default currency.
3. A single assignment opens automatically. For multiple assignments, the header store picker saves your selection in the browser. Use the language menu to choose Azerbaijani, English, or Russian.
4. Password reset uses `/auth/callback`. Allow the full callback URL in Supabase and open the reset email in Mailpit when testing locally.

## Local salesperson invitations

1. Apply the Prisma migrations and start local Supabase with Mailpit SMTP enabled. For the API process set `MIZAN_SMTP_URL=smtp://127.0.0.1:54325` and `MIZAN_INVITATION_FROM=mizan@example.test`. When using a different loopback SMTP port, set the URL to match. Keep the full stack on loopback and use test addresses during development.
2. Create an invitation through the API with an owner session. Open Mailpit at http://127.0.0.1:54324 and follow the captured link in a separate browser profile or private window.
3. Sign in or register using the invited address. If Supabase requires confirmation, confirm the email before accepting the invitation. Creating an Auth account alone does not grant store access. Use confirmed email settings for hosted environments.
4. A link expires after 48 hours and can be accepted once. Resending creates a new link and invalidates the old one. If SMTP fails, the owner can resend the stored invitation. Deactivation and store removal preserve the membership and assignment records while blocking access on the next API request.

## Organization settings

Open **Organization settings** from an owner workspace. The default currency is set during onboarding. Owners can change salesperson cost visibility, manage purity grades, and enter exact purchase rates per gram for each currency and purity. Changing a rate creates a history entry. Deactivating a grade removes it from new rate entry while keeping its history.

## Local product photos

Run `pnpm exec supabase seed buckets` to provision the private `product-photos` bucket from `supabase/config.toml` in an existing local stack. Set `SUPABASE_SERVICE_ROLE_KEY` only in the API process to enable signed photo operations. Product creation and lookup work without Storage credentials.

To run the live photo test, set `MIZAN_TEST_STORAGE_ORIGIN` and `MIZAN_TEST_STORAGE_SERVICE_ROLE_KEY` for the local stack, then run `pnpm --filter @mizan/api test products.integration.test.ts`.

# Mizan

Mizan is an inventory and sales app for jewelry stores, available in Azerbaijani and English. The workspace has a Next.js web app, a Fastify API, and separate packages for API contracts and the database.

## Local development

1. Use Node.js 22.13 or later in the 22 line, or Node.js 24, with pnpm 12.6.0. Start Docker Desktop for database, authentication, storage, and local email.
2. Run `pnpm install --frozen-lockfile` in this directory.
3. Run `pnpm supabase:start` to start local Supabase. The first startup downloads Docker images. Supabase Studio is at http://127.0.0.1:54323 and its captured development emails are at http://127.0.0.1:54324. [Supabase local development guide](https://supabase.com/docs/guides/local-development/cli/getting-started)
4. Run `pnpm dev` to start the web app at http://127.0.0.1:3000 and the API at http://127.0.0.1:3001. Open http://127.0.0.1:3001/api/v1/health to check that the API process responds.
5. Stop the app processes with Ctrl+C and run `pnpm supabase:stop` to stop Supabase while retaining development data.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm build` from the workspace root to verify changes.

The frontend uses Tailwind CSS and Lucide React with the Zümrüd design tokens. On Windows, put the supported Node executable first on PATH before running the web build. Next.js starts a separate process for CSS compilation.

## Database changes

With local Supabase running, set `DATABASE_URL` in your shell to the local PostgreSQL connection string reported by the Supabase CLI. Keep this value server-side. Mizan tables use the private `mizan` PostgreSQL schema.

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

To include API access, onboarding, invitation, and settings integration tests, apply the migrations to a disposable local test database, run `pnpm build`, and set `MIZAN_TEST_DATABASE_URL` in the shell before running `pnpm test`. These tests can leave fixtures in that disposable database.

## Owner signup and language

1. With the local Supabase stack available, export `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the shell that starts the API and web app. Export `DATABASE_URL` for the API and apply the Prisma migrations before starting the apps. See `.env.example` for the expected variables.
2. Open http://127.0.0.1:3000/register. Register or sign in, then enter the business name, first store name, and default currency. If email confirmation is enabled, allow the application's `/auth/callback` URL in Supabase and follow the confirmation link. A signed-in owner can return to registration to finish an interrupted setup.
3. The workspace opens automatically for a single assignment and shows a store picker when more than one is available. English and Azerbaijani are selectable in the page header, and the choice is saved in the browser.

## Local salesperson invitations

1. Apply the Prisma migrations and start local Supabase with Mailpit SMTP enabled. For the API process set `MIZAN_SMTP_URL=smtp://127.0.0.1:54325` and `MIZAN_INVITATION_FROM=mizan@example.test`. When using a different loopback SMTP port, set the URL to match. Keep the full stack on loopback and use test addresses during development.
2. As an owner, open **Salespeople and invitations** in the workspace. Choose a store and send the invite. Open Mailpit at http://127.0.0.1:54324 and follow the captured link in a separate browser profile or private window.
3. Sign in or register using the invited address. If Supabase requires confirmation, confirm the email before accepting the invitation. Creating an Auth account alone does not grant store access. Use confirmed email settings for hosted environments.
4. A link expires after 48 hours and can be accepted once. Resending creates a new link and invalidates the old one. If SMTP fails, the owner can resend the stored invitation. Deactivation and store removal preserve the membership and assignment records while blocking access on the next API request.

## Organization settings

Open **Organization settings** from an owner workspace. The default currency is set during onboarding. Owners can change salesperson cost visibility, manage purity grades, and enter exact purchase rates per gram for each currency and purity. Changing a rate creates a history entry. Deactivating a grade removes it from new rate entry while keeping its history.

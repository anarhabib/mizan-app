# Local setup

Run these commands in PowerShell from the repository root. Use Node.js 22.13 or newer within the 22 release line, or Node.js 24, pnpm 12.6.0, and Docker Desktop with Linux containers. `pnpm.cmd` avoids PowerShell's restriction on unsigned `pnpm.ps1` scripts. Put the supported Node executable first on `PATH` so child processes use it too.

## Install and start services

```powershell
node --version
pnpm.cmd --version
docker info
pnpm.cmd install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
pnpm.cmd supabase:start
if ($LASTEXITCODE -ne 0) { throw 'Supabase startup failed' }
```

The first Supabase start downloads images. Existing development data stays in Docker volumes across ordinary stops and starts. Prisma owns application migrations in `packages/database/prisma/migrations`. The Supabase Data API exposes `public` and `graphql_public`; application tables use the private `mizan` schema.

## Configure the process environment

`.env.example` lists supported variables. Fastify and the Prisma configuration read the process environment. A root `.env` file alone does not configure those processes. The following block reads local CLI credentials into this PowerShell session without printing them.

```powershell
$mizanLocal = pnpm.cmd exec supabase status --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot read local Supabase status' }
$env:DATABASE_URL = $mizanLocal.DB_URL
$env:SUPABASE_URL = $mizanLocal.API_URL
$env:SUPABASE_PUBLISHABLE_KEY = $mizanLocal.ANON_KEY
$env:SUPABASE_SERVICE_ROLE_KEY = $mizanLocal.SERVICE_ROLE_KEY
$env:MIZAN_WEB_ORIGIN = 'http://127.0.0.1:3000'
$env:MIZAN_API_URL = 'http://127.0.0.1:3001'
$env:MIZAN_SMTP_URL = 'smtp://127.0.0.1:54325'
$env:MIZAN_INVITATION_FROM = 'mizan@example.test'
$env:PORT = '3001'
if (!$env:DATABASE_URL -or !$env:SUPABASE_PUBLISHABLE_KEY) {
  throw 'Local status did not include database and Auth configuration'
}
```

`SUPABASE_PUBLISHABLE_KEY` accepts the local anon key for legacy HS256 verification. `SUPABASE_SERVICE_ROLE_KEY` enables signed product photo operations and belongs only in server process environments. The frontend session configuration uses `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. `MIZAN_API_URL` is the web server's address for Fastify. `MIZAN_WEB_ORIGIN` is used for links, callbacks, and secure-cookie selection.

Apply migrations to the local development database and provision the private photo bucket.

```powershell
pnpm.cmd --filter @mizan/database run generate
if ($LASTEXITCODE -ne 0) { throw 'Prisma generation failed' }
pnpm.cmd --filter @mizan/database run migrate
if ($LASTEXITCODE -ne 0) { throw 'Prisma migration failed' }
pnpm.cmd exec supabase seed buckets
if ($LASTEXITCODE -ne 0) { throw 'Storage bucket provisioning failed' }
pnpm.cmd dev
```

Each independently opened terminal needs its own environment configuration. `pnpm dev` builds the shared packages, then starts Fastify and Next.js. For a production build locally, run `pnpm.cmd build`, then run `pnpm.cmd --filter @mizan/api start` and `pnpm.cmd --filter @mizan/web start` in separate configured terminals.

## Local addresses and workflows

| Service | Address |
| --- | --- |
| Web | http://127.0.0.1:3000 |
| Fastify health | http://127.0.0.1:3001/api/v1/health |
| Supabase API/Auth/Storage | http://127.0.0.1:54321 |
| PostgreSQL | `127.0.0.1:54322` |
| Supabase Studio | http://127.0.0.1:54323 |
| Mailpit captured email | http://127.0.0.1:54324 |
| Mailpit SMTP | `127.0.0.1:54325` |

Open `/register`, create an owner, and enter the organization, first store, and default currency. The local Supabase configuration disables email confirmation. If enabling confirmation, keep `http://127.0.0.1:3000/auth/callback` in the allowed redirect URLs and follow the email captured in Mailpit.

From the owner workspace, use `/settings` for cost visibility, purity grades, and purchase rates, and `/settings/users` for invitations. Follow a captured invitation in a separate browser profile so the owner session stays available. Invitations expire after 48 hours and support new and existing Auth accounts. The application starts in Azerbaijani and remembers the selected interface language.

Use `/products/new` to add inventory, `/products` to find items, and `/sales/new` to record an ordinary sale or old-gold trade-in. Keep money and weights as explicit decimal inputs with currency, grams, and purity. Sale confirmation saves the selected rate and financial snapshots for later history.

## Verification

Use a disposable database for integration tests. These tests can retain fixtures. This example creates a separate PostgreSQL container with a loopback-only port and keeps the development database URL for restoration afterward.

```powershell
$mizanDevelopmentDatabase = $env:DATABASE_URL
docker run --name mizan-verification-db -e POSTGRES_PASSWORD=mizan-local-test -p 127.0.0.1:55438:5432 -d postgres:17-alpine
if ($LASTEXITCODE -ne 0) { throw 'Test database creation failed' }
$mizanDatabaseReady = $false
for ($mizanAttempt = 0; $mizanAttempt -lt 60; $mizanAttempt++) {
  docker exec mizan-verification-db pg_isready -U postgres | Out-Null
  if ($LASTEXITCODE -eq 0) { $mizanDatabaseReady = $true; break }
  Start-Sleep -Seconds 1
}
if (!$mizanDatabaseReady) { throw 'Test database did not become ready' }
$env:DATABASE_URL = 'postgresql://postgres:mizan-local-test@127.0.0.1:55438/postgres'
$env:MIZAN_TEST_DATABASE_URL = $env:DATABASE_URL
pnpm.cmd --filter @mizan/database run migrate
if ($LASTEXITCODE -ne 0) { throw 'Test database migration failed' }
pnpm.cmd build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
pnpm.cmd --filter @mizan/database run test:integration
if ($LASTEXITCODE -ne 0) { throw 'Schema integration tests failed' }
pnpm.cmd lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed' }
pnpm.cmd typecheck
if ($LASTEXITCODE -ne 0) { throw 'Type checking failed' }
pnpm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Workspace tests failed' }
pnpm.cmd format:check
$env:DATABASE_URL = $mizanDevelopmentDatabase
Remove-Item Env:MIZAN_TEST_DATABASE_URL
```

For the real Storage integration test, set `MIZAN_TEST_STORAGE_ORIGIN` to the local Supabase API URL and `MIZAN_TEST_STORAGE_SERVICE_ROLE_KEY` to its local service-role key before running `pnpm.cmd --filter @mizan/api test products.integration.test.ts`. The database integration tests use `DATABASE_URL`; the API integration tests use `MIZAN_TEST_DATABASE_URL`. An unset API test URL skips those integration cases.

The Playwright acceptance suite creates real accounts, invitations, products, and sales, and expires one test invitation through SQL. Use a disposable local Supabase stack. Its `MIZAN_TEST_DATABASE_URL` must equal the database configured in the running API. The suite requires local email confirmation to be disabled, as in the checked-in configuration. It retains fixtures with unique account names for inspection.

For the isolated stack used in Task 12, prepare a separate configuration without resetting the development stack.

```powershell
New-Item -ItemType Directory -Force .local/acceptance/supabase | Out-Null
$mizanTestConfig = Get-Content supabase/config.toml -Raw
$mizanTestConfig = $mizanTestConfig.Replace('mizan-app', 'mizan-task12').Replace('543', '553').Replace('3000', '3100')
Set-Content .local/acceptance/supabase/config.toml $mizanTestConfig
pnpm.cmd exec supabase start --workdir .local/acceptance
if ($LASTEXITCODE -ne 0) { throw 'Acceptance stack startup failed' }
$mizanAcceptance = pnpm.cmd exec supabase status --workdir .local/acceptance --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Acceptance stack status failed' }
$env:DATABASE_URL = $mizanAcceptance.DB_URL
$env:MIZAN_TEST_DATABASE_URL = $env:DATABASE_URL
$env:SUPABASE_URL = $mizanAcceptance.API_URL
$env:SUPABASE_PUBLISHABLE_KEY = $mizanAcceptance.ANON_KEY
$env:SUPABASE_SERVICE_ROLE_KEY = $mizanAcceptance.SERVICE_ROLE_KEY
$env:MIZAN_WEB_ORIGIN = 'http://127.0.0.1:3100'
$env:MIZAN_API_URL = 'http://127.0.0.1:3101'
$env:PORT = '3101'
$env:MIZAN_SMTP_URL = 'smtp://127.0.0.1:55325'
$env:MIZAN_INVITATION_FROM = 'mizan@example.test'
$env:MIZAN_TEST_MAILPIT_URL = 'http://127.0.0.1:55324'
pnpm.cmd --filter @mizan/database run migrate
if ($LASTEXITCODE -ne 0) { throw 'Acceptance migrations failed' }
pnpm.cmd build
if ($LASTEXITCODE -ne 0) { throw 'Acceptance build failed' }
pnpm.cmd exec playwright install chromium
if ($LASTEXITCODE -ne 0) { throw 'Chromium installation failed' }
```

Start the API with `pnpm.cmd --filter @mizan/api start` and the web server with `pnpm.cmd --filter @mizan/web exec next start --hostname 127.0.0.1 --port 3100` in separate terminals with that same environment. In another configured terminal run `pnpm.cmd exec playwright test`. Stop both application processes afterward and run `pnpm.cmd exec supabase stop --workdir .local/acceptance` to retain test data. Acceptance evidence and unverified states are recorded in `PROJECT_STATE.md`.

## Troubleshooting and shutdown

- If Docker reports a missing named pipe, start Docker Desktop and wait for `docker info` to succeed.
- If a supported Node version is installed but the build rejects the runtime, check `node --version` in the same terminal and put its installation directory first on `PATH`.
- A protected API returning 503 usually means missing Auth/database configuration. Restart the API after correcting its environment. A health response confirms the HTTP process, so also exercise a signed-in protected route.
- A 401 can indicate a token issuer mismatch. Use `127.0.0.1` consistently for the Supabase URL and the token issuer. A 403 requires an active organization membership and store assignment.
- If the photo action is unavailable, check the API service-role key and private bucket provisioning. Check SMTP settings and Mailpit for invitation delivery failures.
- A port conflict requires stopping the process using that port or updating the app origin, API URL, callback configuration, and test configuration together.
- If the test database container already exists, inspect it with `docker ps -a` and either reuse that disposable database or choose a new container name and port.

Stop app processes with Ctrl+C, then run `pnpm.cmd supabase:stop` and `docker stop mizan-verification-db` if that test container was created. Check published bindings with `docker ps`. Docker Desktop on this machine has previously published Supabase ports on all interfaces, so stop the local stack when finished. Back up retained data using [the backup and restore procedure](BACKUP_RESTORE.md) before any deliberate volume removal or reset.

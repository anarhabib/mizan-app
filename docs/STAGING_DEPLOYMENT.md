# Misqal staging deployment

Use the existing Supabase Cloud project for PostgreSQL, Auth and Storage. Deploy a reviewed revision of `anarhabib/mizan-app` manually. Both builds run from the repository root.

## Render web service

Choose the **Node** runtime, leave **Root Directory** blank, set **Auto-Deploy** to **Off**, and use `/api/v1/health` for the health check. Render supplies `PORT` and the API binds to `0.0.0.0`. [Render web service settings](https://render.com/docs/web-services)

| Setting                                   | Value                                                                                                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build Command                             | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @mizan/contracts build && pnpm --filter @mizan/database build && pnpm --filter @mizan/api build` |
| Start Command                             | `pnpm --filter @mizan/api start`                                                                                                                                                  |
| `NODE_VERSION`                            | `24.22.3`. Corepack uses pnpm `12.6.0` from the root `packageManager` field.                                                                                                      |
| `SKIP_INSTALL_DEPS`                       | `true`. The build command installs the workspace.                                                                                                                                 |
| `DATABASE_URL`                            | Existing project's PostgreSQL session pooler URI with TLS. See below.                                                                                                             |
| `SUPABASE_URL`                            | Existing project URL, `https://<project-ref>.supabase.co`.                                                                                                                        |
| `SUPABASE_PUBLISHABLE_KEY`                | Existing project's publishable key.                                                                                                                                               |
| `SUPABASE_SERVICE_ROLE_KEY`               | Existing project's service-role key for signed product photos. Keep it in Render only.                                                                                            |
| `MIZAN_WEB_ORIGIN`                        | `https://<staging-project>.pages.dev` or the chosen staging custom origin. Use the exact origin without a path or trailing slash. Also used for invitation links.                 |
| `MIZAN_GOLD_PRICE_PROVIDER`               | `gold-api` for market prices or `off`.                                                                                                                                            |
| `MIZAN_GOLD_PRICE_SYNC`                   | `on-demand` to avoid starting the background market sync. `interval` enables it.                                                                                                  |
| `MIZAN_SMTP_URL`, `MIZAN_INVITATION_FROM` | Optional existing SMTP relay and verified sender. Render Free blocks outbound ports 25, 465 and 587.                                                                              |

Get the **Session pooler** URI from the existing project's **Connect** panel. Its shape is `postgresql://postgres.<project-ref>:<url-encoded-password>@<pooler-host>:5432/postgres?sslmode=verify-full`. Use the host and database role from the dashboard. If the endpoint needs Supabase's CA, upload the certificate as a Render secret file and append `&sslrootcert=/etc/secrets/prod-supabase.cer` using the actual filename. Keep certificate verification enabled. A direct connection requires working IPv6 or Supabase's IPv4 add-on. Use session mode on port `5432` to retain prepared-statement support with `@prisma/adapter-pg`. [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres) · [node-postgres TLS](https://node-postgres.com/features/ssl)

The database build generates Prisma Client and compiles the database workspace package before the API build. Keep the workspace install and build outputs available at runtime. Confirm the existing database already matches the selected revision before opening staging to users. If schema versions differ, stop and review separately. Leave Render's pre-deploy command blank and keep `prisma migrate deploy`, resets, and seeds out of build and start.

## Cloudflare Pages

Choose **Pages** with no framework preset, the reviewed staging branch as the production branch, and the repository root as **Root directory**. Disable automatic production and preview deployments in branch controls after the initial manual setup. Set the following build settings and environment variables. [Pages build image](https://developers.cloudflare.com/pages/configuration/build-image/) · [Pages branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/)

| Setting                         | Value                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Build command                   | `pnpm install --frozen-lockfile --prod=false && pnpm --filter @mizan/contracts build && pnpm --filter web build` |
| Build output directory          | `apps/web/dist`                                                                                                  |
| `NODE_VERSION`, `PNPM_VERSION`  | `24.22.3`, `12.6.0`                                                                                              |
| `SKIP_DEPENDENCY_INSTALL`       | `1`. The build command runs pnpm explicitly.                                                                     |
| `VITE_API_BASE_URL`             | `https://<render-service>.onrender.com/api/v1`, without a trailing slash.                                        |
| `VITE_SUPABASE_URL`             | Same existing project URL as on Render.                                                                          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing project's publishable key.                                                                              |

Pages serves the root HTML for SPA paths such as `/products` and `/auth/callback` when the output has no top-level `404.html`. Keep that file absent. [Pages SPA routing](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering)

## Supabase Auth and first deployment

1. Choose the stable Pages hostname and confirm the reviewed revision matches the existing database schema. Configure Render with that hostname as `MIZAN_WEB_ORIGIN`. Deploy Render manually and verify the health endpoint.
2. In the existing Supabase project, open **Authentication → URL Configuration**. Set **Site URL** to `https://<staging-project>.pages.dev` (or the chosen staging custom origin). Add `https://<staging-project>.pages.dev/auth/callback**` under **Redirect URLs**, replacing the host with the same staging host. The suffix covers recovery and callbacks with OAuth query parameters. Retain existing redirect entries, including `http://127.0.0.1:3000/auth/callback**` for local development and any currently used `localhost` equivalent. Google and Apple continue to return to the existing Supabase provider callback `https://<project-ref>.supabase.co/auth/v1/callback`. [Supabase redirect settings](https://supabase.com/docs/guides/auth/redirect-urls)
3. Set the Render HTTPS API URL in Pages and start the initial Pages deployment. For later manual releases with automatic builds disabled, build locally with the same public variables and run `wrangler pages deploy apps/web/dist --project-name <staging-project> --branch <staging-branch>`. Existing users sign in on the staging origin, where the browser stores their staging session. [Pages manual deployment](https://developers.cloudflare.com/pages/configuration/git-integration/#disable-automatic-deployments)

## Smoke checks and troubleshooting

- Open Render's `/api/v1/health` and confirm HTTP 200 with `{"status":"ok"}`. Health verifies process availability. A signed-in store read verifies database and permissions.
- In Pages, sign in with an existing test user using email/password, Google, and Apple as applicable. Confirm the callback returns to Pages. Reload `/products` and verify the SPA loads and signed product thumbnails appear where available. Use existing data for checks.
- Confirm the browser's protected requests go to Render. An `OPTIONS` preflight from the canonical Pages origin should return that exact `Access-Control-Allow-Origin` and allow `Authorization`, `Content-Type`, `Idempotency-Key`, and `Sale-Confirmation`. If it fails, check `MIZAN_WEB_ORIGIN`, the deployed host, and the `/api/v1` suffix on `VITE_API_BASE_URL`.
- For a route 404 on refresh, check the Pages output directory and top-level `404.html`. For an OAuth redirect to the wrong host, check Supabase's Site URL and redirect allowlist. For database timeouts or TLS errors, verify the session pooler hostname, port, encoded password, and CA settings. Rebuild Pages after changing any `VITE_*` value.

# Mizan — Frontend conventions

Read this before any UI task. Keep it short; update only when a convention changes.

## Structure

```
apps/web/src/
  app/        providers, query client, layout shell, workspace provider
  routes/     TanStack Router file routes: thin, only compose feature components
  features/<name>/
    api/        typed API functions, query key factory, queryOptions(), mutation hooks
    components/
    hooks/
    index.ts    the only public entry point
  shared/
    ui/         shadcn components (CLI-managed, do not edit or regenerate) + BrandMark, PageHeader, etc.
    lib/        api client, auth (supabase), format, form helpers, i18n setup
    hooks/
  locales/      az/, en/ and ru/, one namespace file per feature
```

Features: `auth`, `workspace`, `products`, `sales`, `settings`, `team`.

The current scaffold keeps CLI-managed primitives in `src/components/ui` and their utility in `src/lib/utils.ts` (aliases in `components.json`). Import these in shared wrappers; do not move or rewrite generated primitives. Application components live in `src/shared/ui`.

- Features import other features only through `index.ts`. `shared` never imports from `features`.
- Business logic lives in hooks or `lib`, not in presentational components.
- Backend contract lives in `docs/API_NOTES.md`. Do not read backend code for endpoint shapes.

## API and auth

- All calls go to `VITE_API_BASE_URL` (`/api/v1`). In development Vite proxies `/api` to the API. No cookies: the API client attaches `Authorization: Bearer <access token>` from the Supabase session.
- `supabase-js` is for Auth only (sign-in, sign-up, session, refresh, password reset). Never use the Supabase Data API, Prisma or the Storage SDK. Photo bytes go only to the signed `uploadUrl` returned by the API.
- No OpenAPI and no generated client: write small typed functions per feature using `@mizan/contracts` types. Where a shared contract is missing, define a local type with a comment pointing at `API_NOTES.md`.
- The API client normalizes every failure into one `ApiError` (status, code, message, optional field, isNetwork). It must handle `{code,message,field?}`, Fastify's default `{statusCode,error,message}`, and network failures.
- Server messages are Azerbaijani. Map known `code`s to i18n strings. Show a server `message` only for 4xx codes listed in `API_NOTES.md`; 5xx and unknown errors show a generic localized message.
- On 401: try one session refresh, then sign out and redirect to `/login`. 503 `AUTH_UNAVAILABLE` is a retryable "try again" state, not a logout.

## Workspace scope and roles

- Every product, sale, settings and membership request needs `organizationId` (store routes also `storeId`). `useWorkspace()` is the only source of these ids; features never read storage themselves.
- Both ids are part of every query key (key factories take `{organizationId, storeId}`), so switching store never shows stale data from another store.
- Roles are `OWNER` and `SALESPERSON`. Hide owner-only UI (settings, team) for salespeople as a convenience; the server enforces access.
- Use the permission flags from `useWorkspace()` for owner actions and acquisition visibility. Display mode is verified by the API and switching it clears query data and reloads the workspace across tabs.
- `acquisitionCost` can be absent for salespeople. Render nothing when it is missing; never show `0` or a placeholder amount.

## Data (TanStack Query)

- All server state goes through TanStack Query. No fetching in `useEffect`, no server data copied into `useState` or a global store.
- Define `queryOptions()` and a key factory per feature. Invalidate exact keys, not broad prefixes. List the keys a mutation invalidates in the PR description.
- For filtered lists, enumerate cached keys under the affected store's list prefix and invalidate each exact key. Invalidate separately keyed facets when their data changes.
- Use `select` for derived data. Set `staleTime` per resource (lists short, settings and options long).
- Lists use `useInfiniteQuery`: pass `nextCursor` unchanged as `after`. Do not invent page size or sort parameters. Debounce search input 300 ms and keep previous data while filters change.
- Every query screen has loading (skeleton), empty and error states with a retry.
- Mutations are never optimistic and never retried automatically. Disable submit while pending.
- `POST /sales` sends an `Idempotency-Key` (`crypto.randomUUID()`, matches `[A-Za-z0-9._:-]{1,128}`). Create the key once per sale attempt, reuse the same key and payload for retries after timeouts or network errors, and create a new key only after a definitive success or when the user changes the payload.
- Other mutations have no idempotency support. After a network failure with unknown outcome, refetch the affected data before allowing another attempt.

## Money, weight, purity and i18n

- `Money` is `{amount: string, currency: string}`. Never assume AZN; always show the currency code.
- Weights are grams as strings (up to 3 decimals). Purity is an integer fineness 1–999 shown as "585", not a percentage.
- Validate, parse and round only through `@mizan/contracts` helpers (`parseDecimal`, `parseMoney`, `currencyMinorUnits`, `roundMoneyHalfUp`). No `parseFloat`, `Number()` or float arithmetic on money or weight. Do not compute money in the UI: show server-calculated values.
- Displayed money rounds half up to two decimal places, with localized separators and the currency code. Forms, requests and stored amounts retain their original precision. Weight formatting preserves the exact digits.
- All user-facing text goes through i18n (Azerbaijani default; English and Russian supported), one namespace per feature. No hard-coded strings in components.

## Forms

- react-hook-form. Validation comes from the `@mizan/contracts` parsers (`parseProductCreate`, `parsePurity`, `parseMoney`) wrapped by one small resolver helper in `shared/lib`; map server `field` errors to form fields.
- Numeric fields are text inputs with `inputMode="decimal"` and string values.
- Show errors after the user has interacted (blur or submit), not on load or while typing.
- Labels always visible (no placeholder-only labels). Set `autocomplete` and `enterkeyhint` where relevant.
- Submit button reflects pending state and is disabled while pending.

## Rendering

- Colocate state with the component that uses it; lift only when needed.
- Global store (if any): selector subscriptions only. No context for frequently changing values.
- React Compiler enabled: no blanket `useMemo`, `useCallback` or `memo`. Memoize a list row component only after profiling shows a problem.
- Stable keys. Avoid inline object or function props to memoized children.
- Virtualize lists only when they exceed roughly 100 visible rows.

## UI rules

- Mobile-first at 360px. `lg:` changes layout, it does not scale things up.
- Base text 14px. Controls `h-9` (`h-8` dense on desktop). Spacing scale: 2, 3, 4, 6 only.
- Desktop content `max-w-5xl`. Bottom navigation on mobile, sidebar on `lg`.
- Lists are rows on mobile; use tables only on `lg` and only when columns help. Dialogs become drawers on mobile.
- The shadcn preset in `components.json` is the visual base (colors, radius, font, icon library). One accent color, defined only by the `--primary` token (set by the preset). Never hardcode colors in components; use semantic tokens (`bg-primary`, `text-muted-foreground`, etc.) so a rebrand is one change. The logo is rendered only by `shared/ui/BrandMark`. Borders over shadows. No gradients, glass blur, emoji icons or cards nested in cards.
- Tabular numbers for amounts and weights. Real labels and real data, never lorem ipsum.
- Touch targets at least 40px on mobile. Visible focus ring. Respect `prefers-reduced-motion`, safe-area insets and OS text scale.
- Use shadcn primitives for overlays, menus, forms and toasts. Do not hand-build them.
- Photos: downscale on the device before upload (longest side about 1600 px, JPEG, under 5 MiB; allowed types JPEG, PNG, WebP).

## Verification (UI)

- Only when asked, or once before a UI PR: check the changed routes at 390px and 1280px, light and dark.
- Report deliberate deviations and states not checked.

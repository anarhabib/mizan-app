# Misqal — Frontend conventions

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
    ui/         composed application UI, including BrandMark and PageHeader
    lib/        api client, auth (supabase), format, form helpers, i18n setup
    hooks/
  locales/      az/, en/ and ru/, one namespace file per feature
```

Features include `auth`, `workspace`, `products`, `sales`, `suppliers`, `settings` and `team`.

Check `src/components/ui` before building an interactive control. Compose installed shadcn primitives for feature-specific UI and use semantic HTML for structure. When authorized to add a missing primitive, run `pnpm dlx shadcn@latest add <component> --cwd apps/web` without overwriting installed components. Remove the replaced implementation and unused translations.

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
- Google and Apple reuse `/auth/callback` and the local return-path validator. Confirm the profile name in Misqal before entering a workspace. Provider metadata only prefills the form. [Provider setup](LOCAL_SETUP.md#google-and-apple-sign-in)

## Workspace scope and roles

- Every product, sale, settings and membership request needs `organizationId` (store routes also `storeId`). `useWorkspace()` is the only source of these ids; features never read storage themselves.
- Both ids are part of every query key (key factories take `{organizationId, storeId}`), so switching store never shows stale data from another store.
- Product categories are organization-scoped. Settings, product forms and inventory filters share the category query for the current organization and role. Use category IDs for selection and localized labels for display.
- Roles are `OWNER` and `SALESPERSON`. Hide owner-only UI (settings, team) for salespeople as a convenience; the server enforces access.
- Use the permission flags from `useWorkspace()` for owner actions and acquisition visibility. Display mode is verified by the API and switching it clears query data and reloads the workspace across tabs.
- `acquisitionCost` can be absent for salespeople. Render nothing when it is missing; never show `0` or a placeholder amount.

## Data (TanStack Query)

Dashboard is the authenticated landing page. Its widgets use scoped summary, activity and chart queries. Preferences are stored on the device per user, organization and store. Quick Actions has independent visibility and always renders immediately below the page header when enabled. Customize previews group order and saves it on Apply. Hiding a section preserves its position and individual widget selections. Empty sections take up no space. Each group has a fixed widget priority for visual, reading and keyboard order. Older saved widget orders are ignored and existing visibility settings carry forward. All groups size their columns from the available container width. Roomy two-column layouts can pair a chart with a neighboring card, and complex tables keep their full span. The grid uses observed card heights to pack items, with a single column on mobile. Some gaps remain where a narrower card would hurt readability or filling the gap would change the reading order. The sales chart uses one query and remembers the amount or transaction-count view. Dashboard links seed the destination's server-side filters using the existing workspace scope. The owner summary is a separate query and is cleared by the existing display-mode switch.

- All server state goes through TanStack Query. No fetching in `useEffect`, no server data copied into `useState` or a global store.
- Define `queryOptions()` and a key factory per feature. Invalidate exact keys, not broad prefixes. List the keys a mutation invalidates in the PR description.
- For filtered lists, enumerate cached keys under the affected store's list prefix and invalidate each exact key. Invalidate separately keyed facets when their data changes.
- Use `select` for derived data. Set `staleTime` per resource (lists short, settings and options long).
- Use `CursorPagination` for paginated tables and directories. Request 10 rows by default and offer 10, 25, 50 and 100. Key each page by workspace, filters, size and cursor. Pass the server cursor unchanged and use cursor history for Previous. Reset cursor history when filters, search or page size changes. Show totals only when the API supplies them. Pickers may use `useInfiniteQuery` to append suggestions. Debounce text search by 300 ms.
- Every query screen has loading (skeleton), empty and error states with a retry.
- Mutations are never optimistic and never retried automatically. Disable submit while pending.
- `POST /sales` sends an `Idempotency-Key` (`crypto.randomUUID()`, matches `[A-Za-z0-9._:-]{1,128}`). Create the key once per sale attempt, reuse the same key and payload for retries after timeouts or network errors, and create a new key only after a definitive success or when the user changes the payload.
- Supplier purchase and payment POSTs also send `Idempotency-Key`. Their retry keys are scoped to the signed-in account, store, operation and request digest. Session storage retains the key for an uncertain attempt without recording the draft.
- Other mutations without idempotency support should refetch the affected data after a network failure with unknown outcome before allowing another attempt.

## Money, weight, purity and i18n

- `Money` is `{amount: string, currency: string}`. Never assume AZN; always show the currency code.
- Weights are grams as strings (up to 3 decimals). Purity is an integer fineness 1–999 shown as "585", not a percentage.
- Show gross jewelry weight and net gold alloy weight separately. Fine gold content can have up to six decimals. Gemstone carat weights are distinct decimal strings with up to five places.
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
- Use `PageContainer` for fluid, centered content in the space available beside the sidebar. Dashboard, Products, Sales, Customers and Suppliers use the wide variant with a 1600px content cap. Settings and Team use standard (64rem). Authentication uses narrow (28rem). Gutters are 16px, 20px from 640px, 24px from 1024px and 32px from 1440px, with safe-area support.
- Bottom navigation on mobile, sidebar on `lg`. The desktop sidebar header holds the collapse control and its footer holds the account menu. On mobile, the account avatar sits beside the store selector in the top header. More holds business destinations available to the current role.
- Products use scoped API aggregates for the inventory overview. Summary links open the matching inventory status, including products whose sale currently has an outstanding balance. On desktop, search and filters share one toolbar that scrolls internally when its controls exceed the available width. On mobile, search stays beside a Filters button that opens the filter drawer.
- Suppliers requires Owner mode and appears in the desktop sidebar and mobile More. Supplier and purchase histories use scoped cursor pagination. The supplier purchase form can stage new products and link eligible existing inventory. Add Product handles single or bulk intake with an explicit registration source. The purchase source uses the active supplier picker, and historical links use the same picker with inactive suppliers included. Show supplier ledger amounts and the registration preview at their recorded precision. The preview uses shared acquisition parsing and integer arithmetic. The API computes the final balance.
- Lists are rows on mobile; use tables only on `lg` and only when columns help. Dialogs become drawers on mobile.
- Preserve the shadcn preset in `components.json`, including typography, radius, icon library, and light and dark themes. Use semantic tokens, subtle card shadows, and brand-accent focus rings. Keep neutral surfaces and independent status colors.
- Tabular numbers for amounts and weights. Real labels and real data, never lorem ipsum.
- Touch targets at least 40px on mobile. Visible focus ring. Respect `prefers-reduced-motion`, safe-area insets and OS text scale.
- Use semantic green, amber, red and blue for success, warning, error and informational feedback across pages. Use the brand accent for small selection indicators. Keep larger surfaces neutral and pair color with a label, icon or accessible state.
- Send localized operation feedback through the single root Sonner Toaster after server confirmation. Use matching Alert and Badge variants for feedback that stays on the page. Keep field errors inline and consequential errors or confirmations visible until addressed.
- Use Skeleton for initial data loading and Spinner in disabled pending actions. Workspace initialization uses a centered brand-accent Spinner with a brief visual delay and an immediate accessible status. Keep existing data visible during background refresh. Use Progress only when the operation reports meaningful progress.
- Photos: downscale on the device before upload (longest side about 1600 px, JPEG, under 5 MiB; allowed types JPEG, PNG, WebP).

## Branding

- `src/shared/ui/BrandMark.tsx` renders the approved light and dark wordmarks and compact marks from `src/assets/branding`. The favicon uses the supplied lime SVG and the Apple Touch Icon uses its 180px raster export.
- `--brand-accent` in `src/index.css` colors small selection indicators and focused control outlines. Keep brand colors centralized and preserve the approved artwork and existing semantic tokens.

## Verification (UI)

- Only when asked, or once before a UI PR: check the changed routes at 390px and 1280px, light and dark.
- Report deliberate deviations and states not checked.

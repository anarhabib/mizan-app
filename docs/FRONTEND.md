# Mizan — Frontend conventions

Read this before any UI task. Keep it short; update only when a convention changes.

## Structure
```
apps/web/src/
  app/        providers, query client, layout shell
  routes/     TanStack Router file routes: thin, only compose feature components
  features/<name>/
    api/        query key factory + queryOptions() + mutation hooks
    components/
    hooks/
    schemas.ts  Zod schemas for forms
    index.ts    the only public entry point
  shared/
    ui/         shadcn components (CLI-managed, do not edit or regenerate)
    lib/        api client, decimal helpers, formatters, i18n setup
    hooks/
  locales/      az/ and en/, one namespace file per feature
```
- Features import other features only through `index.ts`.
- `shared` never imports from `features`.
- Business logic lives in hooks or `lib`, not in presentational components.
- Backend contract lives in `docs/API_NOTES.md`. Do not read backend code for endpoint shapes.

## Data (TanStack Query)
- All server state goes through TanStack Query. No fetching in `useEffect`, no server data copied into `useState` or a global store.
- Define `queryOptions()` and a key factory per feature. Invalidate exact keys, not broad prefixes.
- Use `select` for derived data. Set `staleTime` per resource (inventory lists short, reference data long).
- Every query screen has loading (skeleton), empty and error states with a retry.
- API errors are normalized to `ApiError` (status, code, message). Map known codes to i18n messages; never show raw server text for unknown errors.
- Mutations: optimistic updates only for harmless toggles. **Never** optimistic for sales, returns, old-gold exchanges or stock adjustments.
- Money-moving or stock-moving mutations: disable submit while pending, send an idempotency key if `API_NOTES.md` says the API supports one, show a clear success or failure result. Never retry them automatically.

## Money, weight and i18n
- AZN amounts, grams and gold purity arrive as decimal strings and stay strings until display.
- No `parseFloat` or float arithmetic for money or weight. Use the shared decimal helper if the UI must compute.
- Format with `Intl.NumberFormat` without hidden rounding. Always show the unit next to the value.
- All user-facing text goes through i18n (Azerbaijani default, English supported), one namespace per feature. No hard-coded strings in components.

## Forms
- react-hook-form + Zod. Numeric fields are text inputs with `inputMode="decimal"` and string values, validated by Zod against decimal-string patterns.
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
- Tables become list rows on mobile. Dialogs become drawers on mobile.
- One accent color, defined only by the `--primary` token. Never hardcode colors in components; use semantic tokens (`bg-primary`, `text-muted-foreground`, etc.) so a rebrand is one change. The logo is rendered only by `shared/ui/BrandMark`. Borders over shadows. No gradients, glass blur, emoji icons or cards nested in cards.
- Tabular numbers for amounts and weights. Real labels and real data, never lorem ipsum.
- Touch targets at least 40px on mobile. Visible focus ring. Respect `prefers-reduced-motion`, safe-area insets and OS text scale.
- Use shadcn primitives for overlays, menus, forms and toasts. Do not hand-build them.

## Verification (UI)
- Only when asked, or once before a UI PR: check the changed routes at 390px and 1280px, light and dark.
- Report deliberate deviations and states not checked.
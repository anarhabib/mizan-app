Status: current

The shadcn preset in components.json is the visual base: Radix Nova/Mist, Inter/Geist, Lucide and existing radius and light/dark colors.

Tokens: semantic background, foreground, border, muted, primary and ring. Preserve preset variables; no additional accent. Respect system theme and forced colors.

Density: 14px base text, compact desktop controls, 44px mobile targets, spacing 2/3/4/6, borders over shadows. Tabular numerals for money and weight.

Shell: one semantic navigation list becomes bottom navigation below lg and a 224px sidebar at lg. Four destinations: products, sales, settings, team. Compact top bar reserves a store-switcher slot. Content max-w-5xl; safe-area padding, skip link, keyboard focus and current-page indication.

Shared components: PageHeader with actions; EmptyState with description/action; ErrorState with localized ApiError and pending-aware retry; ListSkeleton with accessible loading label and reduced-motion support; MoneyText, WeightText and PurityText preserve exact values and units. Routes show translated placeholders only.

Rebranding: the logo lives only in apps/web/src/shared/ui/BrandMark.tsx (plain Mizan wordmark); the accent color lives only in the --primary token in apps/web/src/index.css.

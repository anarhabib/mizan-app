Status: current

The shadcn preset in components.json is the visual base: Radix Nova/Mist, Inter/Geist, Lucide and existing radius and light/dark colors.

Tokens: semantic background, foreground, border, muted, primary and ring. Preserve preset variables; no additional accent. Respect system theme and forced colors.

Surface and control tokens:

| Token                                    | Light                 | Dark                  |
| ---------------------------------------- | --------------------- | --------------------- |
| `--background` (page)                    | `#E5E8EC`             | `#08090B`             |
| `--card`, `--popover` (panels)           | `#FFFFFF`             | `#14171B`             |
| `--muted`, `--secondary` (nested blocks) | `#EEF1F5`             | `#1F242A`             |
| `--border`                               | `#CBD1D8`             | `#2E353D`             |
| `--control` / `--control-border`         | `#F3F5F7` / `#78828E` | `#262C33` / `#444D57` |

Status tokens use semantic background, foreground and 25%-opacity border colors: success `#E3F6E8` / `#14632B` in light and `#12301D` / `#5FD982` in dark; warning `#FFF3CC` / `#7A5200` and `#3A2E0A` / `#F5C542`; danger `#FDE4E2` / `#A3231A` and `#3A1512` / `#FF7A70`. Badges retain visible text labels. Native controls use the matching light/dark color scheme.

Density: 14px base text, compact desktop controls, 44px mobile targets, spacing 2/3/4/6, borders over shadows. Tabular numerals for money and weight.

Shell: one semantic navigation list becomes bottom navigation below lg and a 224px sidebar at lg. Four destinations: products, sales, settings, team. Compact top bar reserves a store-switcher slot. Content max-w-5xl; safe-area padding, skip link, keyboard focus and current-page indication.

Shared components: PageHeader with actions; EmptyState with description/action; ErrorState with localized ApiError and pending-aware retry; ListSkeleton with accessible loading label and reduced-motion support; MoneyText, WeightText and PurityText preserve exact values and units. Routes show translated placeholders only.

Rebranding: the logo lives only in apps/web/src/shared/ui/BrandMark.tsx (plain Mizan wordmark); the accent color lives only in the --primary token in apps/web/src/index.css.

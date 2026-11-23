Status: current

The shadcn preset in components.json is the visual base: Radix Nova/Mist, Inter/Geist, Lucide and existing radius and light/dark colors.

Tokens include semantic background, foreground, border, muted, primary, and ring. Use `--brand-accent` for small selection indicators. Respect system theme and forced colors.

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

The shell uses the same route configuration for bottom navigation below `lg` and the collapsible 224px shadcn Sidebar on desktop. Destinations are Products, Sales, Customers, Settings, and Team. Settings and Team require Owner mode. The top bar retains store and account controls, and content retains safe-area padding, a skip link, keyboard focus, and the current-page indicator.

Shared components include PageHeader with actions, EmptyState with a description and action, ErrorState with a localized API error and pending-aware retry, and ListSkeleton with an accessible loading label and reduced-motion support. MoneyText displays two decimal places and a currency code. WeightText and PurityText preserve exact values and units.

Misqal's approved SVGs live in `apps/web/src/assets/branding`. `BrandMark` uses the corresponding light and dark artwork for the full wordmark and compact mark. The favicon uses the lime mark. Active navigation and pricing tabs use the brand accent, with higher contrast on light surfaces.

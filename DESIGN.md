Status: current

## Mobile forms

- Reuse `ProductPanel` for form overlays. It renders a bottom drawer below `lg` and a right sheet on desktop. Provide an accessible title and the actual opener. On close, return focus to that opener or provide a fallback when it disappears. Scope Escape and dismissal to the panel and its controls. Block dismissal during pending submissions.
- Keep the mobile panel body as the form's primary vertical scroll container. Let it shrink between the header and footer, clip overflow at the drawer shell, and stop vertical overscroll from chaining outside the body. Keep primary actions reachable in `mobileFooter` when needed and associate the footer submit button with its form using `form` and the form ID. Keep one submit path with native validation and a pending guard. Keep desktop actions in the sheet flow.
- Use the existing visual viewport binding to fit the drawer above the keyboard and scroll a focused field into view within the form body. Preserve vertical touch scrolling and pinch zoom. Keep the header and footer clear of safe-area insets. Avoid document scrolling, global keyboard handlers, and browser-specific workarounds without a verified reproduction.
- Use shared `Input` with `type="date"`. Keep the input and its grid or flex parent shrinkable. Check empty and populated values in narrow columns. Preserve native date selection and accessible labels.
- Reuse the domain's searchable picker. Use `SupplierPicker` for active and historical suppliers. Keep search and options reachable in the form scroll flow. Opening focuses search, an option tap can finish after search loses focus, Escape closes the picker first, and choosing an option returns focus to its trigger. Search Enter and option buttons must keep the enclosing form open without submitting it.

## Design system

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

The shell uses bottom navigation below `lg` and the collapsible 224px shadcn Sidebar on desktop. Dashboard is the default destination, followed by Products, Sales, and Customers. Suppliers, Settings and Team require Owner mode and appear in the mobile More menu. The sidebar header holds the collapse control. Account controls live in the desktop sidebar footer and under the mobile header avatar. The top bar holds the store selector. Page containers keep headers and content aligned, with safe-area gutters and a 1600px cap for wide pages. The shell retains its skip link, visible keyboard focus and current-page indicator.

Shared components include PageHeader with actions, EmptyState with a description and action, ErrorState with a localized API error and pending-aware retry, and ListSkeleton with an accessible loading label and reduced-motion support. MoneyText displays two decimal places and a currency code. WeightText and PurityText preserve exact values and units.

Misqal's approved SVGs live in `apps/web/src/assets/branding`. `BrandMark` uses the corresponding light and dark artwork for the full wordmark and compact mark. The favicon uses the lime mark. Active navigation and pricing tabs use the brand accent, with higher contrast on light surfaces.

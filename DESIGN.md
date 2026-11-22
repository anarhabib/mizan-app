Status: current

# Misqal visual design

## Brand identity

Misqal is a technology company providing mobile-first business management software for jewelry retailers, not a jewelry retailer. The official identity is logo concept **03 — Flat Ends**: lowercase geometric wordmark, customized lowercase `m` symbol, and the supplied SVG geometry. The target domain is `misqal.az`; its registration and deployment are unverified.

The canonical assets are in `apps/web/src/assets/branding/`:

| Asset                                                                               | Use                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `misqal-03-flat-ends-wordmark-light.svg`                                            | App light theme (dark mark with lime detail)                        |
| `misqal-03-flat-ends-wordmark-dark.svg`                                             | App dark theme (white mark with lime detail)                        |
| `misqal-03-flat-ends-wordmark-mono-black.svg`                                       | Monochrome wordmark on light surfaces or constrained contexts       |
| `misqal-03-flat-ends-wordmark-mono-white.svg`                                       | Monochrome wordmark on dark surfaces or constrained contexts        |
| `misqal-03-flat-ends-symbol-m-black.svg` / `misqal-03-flat-ends-symbol-m-white.svg` | Standalone monochrome symbol where a wordmark does not fit          |
| `misqal-03-flat-ends-icon-dark.svg`                                                 | Browser icon for light system appearance (white field, dark symbol) |
| `misqal-03-flat-ends-icon-light.svg`                                                | Browser icon for dark system appearance (dark field, light symbol)  |
| `misqal-03-flat-ends-icon-lime.svg`                                                 | Brand asset only; not an application theme or accent color          |

`shared/ui/BrandMark` is the single UI wordmark entry point. It selects the light or dark wordmark with the active `.dark` theme class and supplies one accessible name; the two images are decorative to assistive technology. The browser favicon links to the supplied icon SVGs by system color preference. No PWA manifest or installable-app icon configuration currently exists.

Use the complete SVG viewBox, preserve aspect ratio, and do not recolor, crop, redraw, or distort assets. Keep the existing clear space inside each viewBox unobstructed; do not crowd marks with adjacent content or add a background to the wordmark. The app wordmark renders at 24px high with automatic width. Use the symbol only when the available space cannot accommodate a legible wordmark. The favicon icons already include their own padding.

Brand-only SVG colors are dark `#14171B`, white `#FFFFFF`, and lime `#AEE036`; icon backgrounds use the supplied white, dark, or lime artwork. These are asset colors, not application tokens. Do not copy them into components or alter them. Preserve the existing `--primary` and all other theme values.

## Implemented application theme

The values below are copied from `apps/web/src/index.css`; that file is authoritative. Both themes use the same five chart colors. Values expressed in OKLCH remain in their source form.

| Token                                             | Light                                                            | Dark                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| `--background`                                    | `#e5e8ec`                                                        | `#08090b`                                              |
| `--foreground`                                    | `oklch(0.148 0.004 228.8)`                                       | `oklch(0.987 0.002 197.1)`                             |
| `--card`, `--card-foreground`                     | `#ffffff`, `oklch(0.148 0.004 228.8)`                            | `#14171b`, `oklch(0.987 0.002 197.1)`                  |
| `--popover`, `--popover-foreground`               | `#ffffff`, `oklch(0.148 0.004 228.8)`                            | `#14171b`, `oklch(0.987 0.002 197.1)`                  |
| `--primary`, `--primary-foreground`               | `oklch(0.218 0.008 223.9)`, `oklch(0.987 0.002 197.1)`           | `oklch(0.925 0.005 214.3)`, `oklch(0.218 0.008 223.9)` |
| `--secondary`, `--secondary-foreground`           | `#eef1f5`, `oklch(0.218 0.008 223.9)`                            | `#1f242a`, `oklch(0.987 0.002 197.1)`                  |
| `--muted`, `--muted-foreground`                   | `#eef1f5`, `#5f6b78`                                             | `#1f242a`, `oklch(0.723 0.014 214.4)`                  |
| `--accent`, `--accent-foreground`                 | `#eef1f5`, `oklch(0.218 0.008 223.9)`                            | `#1f242a`, `oklch(0.987 0.002 197.1)`                  |
| `--destructive`                                   | `oklch(0.577 0.245 27.325)`                                      | `oklch(0.704 0.191 22.216)`                            |
| `--border`                                        | `#cbd1d8`                                                        | `#2e353d`                                              |
| `--input`                                         | `#a7b0ba`                                                        | `#444d57`                                              |
| `--control`, `--control-border`                   | `#f3f5f7`, `#78828e`                                             | `#262c33`, `#444d57`                                   |
| `--control-hover-border`                          | `#6f7a87`                                                        | `#6f7a87` (inherited)                                  |
| `--overlay`                                       | `#000000`                                                        | `#000000`                                              |
| `--success`, `--success-foreground`               | `#e3f6e8`, `#14632b`                                             | `#12301d`, `#5fd982`                                   |
| `--success-border`                                | `color-mix(in srgb, var(--success-foreground) 25%, transparent)` | Same expression                                        |
| `--warning`, `--warning-foreground`               | `#fff3cc`, `#7a5200`                                             | `#3a2e0a`, `#f5c542`                                   |
| `--warning-border`                                | `color-mix(in srgb, var(--warning-foreground) 25%, transparent)` | Same expression                                        |
| `--danger`, `--danger-foreground`                 | `#fde4e2`, `#a3231a`                                             | `#3a1512`, `#ff7a70`                                   |
| `--danger-border`                                 | `color-mix(in srgb, var(--danger-foreground) 25%, transparent)`  | Same expression                                        |
| `--ring`                                          | `oklch(0.723 0.014 214.4)`                                       | `oklch(0.56 0.021 213.5)`                              |
| `--chart-1`                                       | `oklch(0.897 0.196 126.665)`                                     | `oklch(0.897 0.196 126.665)`                           |
| `--chart-2`                                       | `oklch(0.768 0.233 130.85)`                                      | `oklch(0.768 0.233 130.85)`                            |
| `--chart-3`                                       | `oklch(0.648 0.2 131.684)`                                       | `oklch(0.648 0.2 131.684)`                             |
| `--chart-4`                                       | `oklch(0.532 0.157 131.589)`                                     | `oklch(0.532 0.157 131.589)`                           |
| `--chart-5`                                       | `oklch(0.453 0.124 130.933)`                                     | `oklch(0.453 0.124 130.933)`                           |
| `--radius`                                        | `0.45rem`                                                        | `0.45rem`                                              |
| `--sidebar`                                       | `#ffffff`                                                        | `#14171b`                                              |
| `--sidebar-foreground`                            | `oklch(0.148 0.004 228.8)`                                       | `oklch(0.987 0.002 197.1)`                             |
| `--sidebar-primary`                               | `oklch(0.218 0.008 223.9)`                                       | `oklch(0.488 0.243 264.376)`                           |
| `--sidebar-primary-foreground`                    | `oklch(0.987 0.002 197.1)`                                       | `oklch(0.987 0.002 197.1)`                             |
| `--sidebar-accent`, `--sidebar-accent-foreground` | `#eef1f5`, `oklch(0.218 0.008 223.9)`                            | `#1f242a`, `oklch(0.987 0.002 197.1)`                  |
| `--sidebar-border`                                | `#cbd1d8`                                                        | `#2e353d`                                              |
| `--sidebar-ring`                                  | `oklch(0.723 0.014 214.4)`                                       | `oklch(0.56 0.021 213.5)`                              |

Status badges use the success, warning, or danger semantic background, foreground, and 25%-opacity border tokens; each retains a visible text label. Native controls use the active theme's color scheme.

## UI foundation and behavior

- **Preset:** `apps/web/components.json` sets shadcn `radix-nova`, `mist`, CSS variables, and Lucide icons. Keep generated shadcn/Radix primitives and this preset as the base.
- **Typography:** Inter Variable for sans-serif text and Geist Variable for headings. Base body text is 14px.
- **Density:** compact desktop controls, spacing scale 2/3/4/6, borders rather than decorative shadows, and tabular numerals for money and weight. Keep the existing radius and component styling.
- **Responsive shell:** mobile bottom navigation and a compact top bar; at `lg` the navigation becomes a 224px sidebar. The content is `max-w-5xl`, with safe-area padding and mobile-friendly controls.
- **Accessibility:** preserve keyboard navigation, visible focus, skip link, current-page state, accessible labels, contrast, reduced-motion behavior, and forced-colors support.
- **Business data:** show server-calculated money, currency codes, exact decimal strings, gram units, and fineness values without reinterpretation.

This document records implemented styling and brand assets only. Future proposals do not authorize changes to the palette, components, typography, spacing, layout, or application behavior.

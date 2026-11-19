# Mizan Design Specification

**Reference** — Mizan Sites version **43**, published November 16, 2026 in Baku. Source commit `5fc3f4a79702570d3c4ba0d7615c349912d1e9ba`.

**Audience** — Codex and developers rebuilding Mizan in a new application repository.

## 1. Design goal and implementation scope

Mizan is a mobile-first management app for a jewelry salesperson. The working interface helps the salesperson identify an individual piece, check its purity, weight and availability, and record the actual sale amount. The desktop layout uses the same visual language and gives dense data more space.

Use this file for interface structure, styling, and interaction. Use `PROJECT_CONTEXT.md` for the confirmed business scope, API and database decisions. Fastify and Prisma are approved for the backend. Select the frontend framework through the implementation brief. Reuse the approved design through components and tokens, then compose one requested feature at a time.

| Decision | Implementation guidance |
| --- | --- |
| First milestone | Sign in, add a product, find it in inventory, open its details, record its sale, and verify the saved result. |
| Initial store | One family-owned store at one location. Design for one salesperson operating independently. |
| Design reference | The published prototype provides layouts, copy, and interaction examples. Its sample records, browser-local demo session, prices, and plan limits are illustrative. |
| First milestone estimate | Display an estimate when an approved value is available. Show `—` or `Hesablanmayıb` when it is unavailable. |
| Later MVP work | Old-gold trade-ins are required in the MVP. Confirm settlement and inventory rules before designing the final transaction flow. Assess other screens as separate implementation tasks. |
| Theme scope | Version 43 supports five palettes. The first milestone can start with the Zümrüd tokens and a theme-ready component structure. Inclusion of the five-choice settings UI in that milestone is open. |

## 2. Reference material

The owner's screenshots and live prototype set the visual baseline for shipped screens. At wide desktop widths, Products and Sales use a compact light-glass filter strip followed by a rounded table with tinted column headings and ruled rows. New Sale uses a wider stock table on the left and a narrower light-glass cart and settlement panel on the right. Use a single column on compact screens and preserve access to table content through scrolling within the table.

Use the prototype's visual treatment with the fields supported by the current milestone. Sales history presents recorded sales with a read-only completion status. Product prices, customer selection, non-cash payment methods, and returns follow their own product and data requirements.

- [Interactive Mizan prototype](https://qizil-anbar-idareetme.auralchess4.chatgpt.site/)
- [Dashboard](https://qizil-anbar-idareetme.auralchess4.chatgpt.site/?view=overview) · [Products](https://qizil-anbar-idareetme.auralchess4.chatgpt.site/?view=products) · [Sales](https://qizil-anbar-idareetme.auralchess4.chatgpt.site/?view=sales) · [Settings](https://qizil-anbar-idareetme.auralchess4.chatgpt.site/?view=settings)
- [Five approved mobile palettes side by side](https://chatgpt.com/library?file_id=libfile_d60f1ad8d63881919af6df9e5015785a&account_id=personal)
- [Earlier screen references for the dashboard, product detail, and barcode flow](https://chatgpt.com/library?file_id=libfile_e6773243cbd481918c532f72612ddb2f&account_id=personal)
- [PROJECT_CONTEXT.md](https://chatgpt.com/library?file_id=libfile_eb5be36b68408191bb46fdc44a1f2606&account_id=personal)

Prototype source map, relative to the **Sites reference checkout**:

| File | Reference content |
| --- | --- |
| `dist/index.html` | App shell, navigation, embedded mark, stylesheet order, PWA links |
| `dist/style.css` → `dist/glass.css` → `dist/themes.css` | Base layout, current component styles and responsive overrides, exact alternative palette values. Inspect the combined cascade. |
| `dist/palette.js`, `dist/navigation.js` | Theme selection and compact-scroll behavior |
| `dist/app.js`, `dist/overview.js`, `dist/camera.js` | Screen structure, Azerbaijani copy, local demo interactions |
| `brand/`, `dist/icon.svg`, `dist/apple-touch-icon.png` | Alternate logo lockups, installed icon appearance and geometry |
| `dist/catalog-jewelry-grid.png` | Sample jewelry imagery used in the prototype |

## 3. Visual language and typography

Use Tailwind CSS utilities and shared design tokens for the frontend. Use Lucide React for interface icons; keep the documented custom SVG for the Mizan brand mark.

Use a light tinted canvas, crisp typography, translucent surfaces with fine highlights, and a few deeper surfaces to guide attention. Give the left sidebar and the headline sales card the same dark surface treatment. Use soft shadow around the perimeter of floating surfaces and a thin inner edge to show depth. Keep secondary information on light glass.

- Use **Manrope** across the dashboard, catalog, landing, account, and pricing screens. Use the same family for headings and body text, with `system-ui, sans-serif` as fallback. Version 43 requests weights 400, 500, 600, 700 and 800 from Google Fonts. It also declares 650 and 750 on selected elements. Load a suitable variable font if exact intermediate weights are needed in the rebuild. Confirm that the chosen font source renders Azerbaijani characters, including **Ə ə, Ğ ğ, İ ı, Ö ö, Ş ş, Ü ü, Ç ç** and the **₼** sign.
- Use sentence case for page titles and UI labels. Compact table headers may use uppercase. Use a clear heading hierarchy and reserve prominent numerals for money, totals and quantities.
- Use stroke icons with rounded ends and a consistent line width, roughly 1.7–2 px. Keep notification and status dots circular. Use the diamond shape in the Mizan mark as part of the logo geometry.

| Role | Reference size and weight |
| --- | --- |
| Default body | 14 px, line height 1.5 |
| Management page title | `clamp(30px, 3.3vw, 48px)`, 700, tracking `-.048em` |
| Mobile page title | `clamp(29px, 8vw, 39px)` |
| Panel / modal title | Around 19 px / 21 px, bold |
| Supporting text | 13–14 px. Use smaller text for labels and secondary metadata. |
| Controls and dense labels | Buttons typically 12 px, form labels 12–13 px, mobile text inputs and selects 16 px |
| Daily headline amount | `clamp(39px, 5vw, 68px)`, 650, line height 1.08, tracking `-.07em`, tabular figures |

### Locale and values

Set the document language to the selected locale: `az` by default or `en` when selected. Translate UI labels and messages and format numbers for that locale. Azerbaijani examples include `1 240,50 ₼`, `4,18 q`, `221,12 ₼/q` and `585 əyar`. Display currency using its minor units and weights in grams. Keep precision and validation in the product and API models. For day-sensitive reporting, use **Asia/Baku** business dates. Use labels that distinguish actual sale amount, estimated selling price, purchase cost, and labor.

## 4. Color and theme tokens

Use semantic color roles in components. Keep the palette IDs stable and labels Azerbaijani. Values below are from version 43.

| Label / ID | Ink | Deep | Main | Accent | Mid | Pale | Canvas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Zümrüd / `emerald` | `#051F20` | `#0B2B26` | `#145440` | `#235347` | `#8EB69B` | `#DAF1DE` | `#EDF4EF` |
| Lacivərt / `navy` | `#14253B` | `#172F4B` | `#23466C` | `#466B93` | `#7998B5` | `#DCE8F4` | `#EDF2F8` |
| Bordo / `burgundy` | `#251931` | `#382247` | `#553273` | `#72488E` | `#A58ABB` | `#EEE0F8` | `#F7F1FB` |
| Bürünc / `bronze` | `#351D18` | `#4B251D` | `#74392B` | `#86442E` | `#B2936D` | `#EEE2D0` | `#F6F1E9` |
| Qızılı / `gold` | `#292502` | `#514100` | `#765E00` | `#826900` | `#EFC43C` | `#FFF9CB` | `#FFFAE2` |

Bordo has a purple main surface, Bürünc has a red-copper surface, and Qızılı has a brighter yellow-gold accent and a warm lemon-cream canvas. Preserve those distinctions in saturated surfaces, pale backgrounds, and logo accents. The board in section 2 shows the approved result.

| Semantic role | Zümrüd reference | Alternative palettes |
| --- | --- | --- |
| Brand mark background / browser theme color | `#0B2B26` | Deep |
| Dark fallback / dark glass fill | `#145440` / `#084B3AE3` | Main / Main at 89% alpha |
| Dark surface edge | `#A4DCC1B5` | Mid at 71% alpha |
| Dark hero background | `#163832` | Main |
| Main / muted text | `#051F20` / `#46645A` | Ink / 78% Ink mixed with white |
| Dark surface text / secondary text | `#F1FFF5` / `#D0F1DC` | `#FFFDFB` / Pale |
| Light surface / field fill | `#F2F8F4` / `#F8FBF9` | 60% Canvas mixed with white |
| Card glass fill | `#FBFDFBCF` | Light surface at 81% alpha |
| Soft selected surface | `#E7F3E9` | 58% Pale mixed with white |
| Default glass edge | `#FFFFFFDC` | Same |
| Focus and accent | `#245347` focus ring, `#235347` accent | Accent |
| Primary fill / hover / pressed | `#0D342D` / `#17483C` / `#08241F` | Deep / Main / Ink |
| Primary text / inverse action fill | `#F5F8F5` / `#FAF9F4` | Same |
| Inverse action hover / pressed | `#EEECE3` / `#E2DFD5` | Same |

Theme selection belongs in `Parametrlər → Rəng paleti`. Use a labeled single-choice group with a preview swatch, label, selected outline, and checkmark. Version 43 uses five columns on desktop and two at widths up to 640 px. Apply the choice immediately, initialize it before first paint when possible, and remember it in the browser. The prototype uses `mizan.palette`, defaults to Zümrüd, and listens for cross-tab changes. Update the app mark and browser theme color from the theme. Palette selection changes color properties only. Preserve measured layout, typography, component variants, overlay geometry, focus, navigation behavior, and stored business data.

## 5. Surfaces, controls, and logo

| Primitive | Visual contract |
| --- | --- |
| Light glass panel | Usually a 26 px radius on desktop and 19 px for mobile panels. Use a faint white edge, a soft perimeter shadow and a top highlight. The shared card shadow uses 22 px blur plus 5 px blur with 1 px spread. |
| Dark glass surface | Match the sidebar and sales hero to the same fill, fine edge and tinted shadow. The reference uses `blur(36px) saturate(145%)`, inset top/side highlights, a lower inset shade, and outer blurs of 26 px and 5 px. |
| Header / mobile navigation | The management header, mobile dock and navigation drawer use 12 px blur and 175% saturation, with 44% background opacity at the top and 64% while scrolled. Public headers use 32 px blur and 175% saturation. Keep icons and text clear when content passes behind the chrome. |
| Form field | At least 44 px high, 12 px corners, light field fill, meaningful label, subtle border, and visible focus ring. Surface field errors next to the related field and preserve other values. |
| Primary / secondary / inverse button | Use a dark fill and pale text on light surfaces. Use outlined light glass for secondary actions. Use a pale inverse action on a dark catalog or landing hero and on the featured plan card. Standard controls are 44 px or taller, with 13 px corners. |
| Action icon | For `Yeni satış` and related page actions, use a small ivory icon tile inside the filled button. The reference uses a 36 px tile on desktop and 30 px on mobile, with 52 px and 46 px button heights respectively. |
| Dialog | Center above an overlay. The reference uses up to 680 px width, 23 px radius, safe-area-constrained `100dvh` height, a 44 px close action and `blur(29px) saturate(165%)`. Use a light solid fallback. Allow tall dialog content to scroll within the viewport and keep confirmation reachable. |
| Data table | Use a light tinted header, subtle row dividers, labeled columns, status pills, readable numbers, and a dedicated overflow area on compact screens. |
| Feedback | Pair inline validation and actionable empty states with concise Azerbaijani messages. Announce asynchronous results and confirmations. Use status text and an icon or shape along with color. |

Keep the primary-action hover lift small, about 2 px, with a subtle 1 px press movement. Use focus-visible outlines and honor reduced-motion settings. Provide readable solid fallbacks for glass effects. Use destructive styling only for actions with destructive or reverse-inventory consequences.

### Mizan mark

The mark is a level beam, two rounded counterweights and one central diamond pivot. Keep the proportions and optical vertical centering. Use a palette-colored SVG in the application. On a dark mark tile, use the Deep role for the tile, Pale or a light theme tint for the beam and weights, and Mid for the pivot. On a light public-header tile, use Deep for the beam and Accent for the pivot. The mobile header uses a rounded 31 px tile. The desktop sidebar uses a 39 px tile around a 30 px mark.

The path geometry in the live desktop mark is provided here for reconstruction from this file:

```html
<svg viewBox="0 0 256 256" aria-hidden="true">
  <g transform="translate(0 24)">
    <path fill="currentColor" d="M62 50h56a21 21 0 0 1 21 21v0a21 21 0 0 1-21 21H62a21 21 0 0 1-21-21v0a21 21 0 0 1 21-21zM138 50h56a21 21 0 0 1 21 21v0a21 21 0 0 1-21 21h-56a21 21 0 0 1-21-21v0a21 21 0 0 1 21-21zM20 120h216v16H20z"/>
    <path fill="var(--mizan-mark-pivot)" d="M128 97 159 128 128 159 97 128z"/>
  </g>
</svg>
```

Set `currentColor` and `--mizan-mark-pivot` on the enclosing mark component. The published install assets use fixed Zümrüd versions of the mark. The reference includes a 180 px Apple touch icon and 192 px and 512 px manifest PNGs. Carry those assets or export equivalent sizes when PWA installation is in scope.

## 6. Responsive shell and navigation

### Desktop and tablet

- **Above 1000 px** — fixed left sidebar 231 px wide, inset 16 px from the viewport edges. Content starts at approximately 263 px. Use the light glass header for breadcrumb, local date, notification action, and account summary. Constrain overall content to roughly 1540 px.
- **761–1000 px** — sidebar 199 px wide and content offset 230 px. Let card grids and tables reduce columns or scroll inside their containers.
- The sidebar groups the store identity, navigation and help. Its active item uses an ivory fill and dark label. Full prototype order is **İcmal**, **Məhsullar**, **Müştəri kataloqu**, **Kamera**, **Satışlar**, **Alış və mal qəbulu**, **Anbar**, **Qalıq müqayisəsi**, **Müştərilər**, **Hesabatlar**, **Abunəlik planları**, **Parametrlər**. Expose destinations as their features ship.

### Mobile

- **760 px and below** — use a centered floating glass dock with **İcmal**, **Məhsullar**, **Kamera**, **Satışlar**, **Daha** in the full demo. Kamera is the visually distinct middle action. Daha and the top-left menu open the full sidebar as a drawer. Use the implemented destinations when rebuilding part of the application.
- The expanded dock is about 65 px high and at most 460 px wide. The compact dock is about 51 px high and at most 328 px wide. Retain a 44 px minimum item target and accessible navigation names when labels fade. Reserve bottom space for the dock and the device safe-area inset.
- The sticky management header stays 54 px tall on mobile and 60 px on desktop. Its glass background goes from 44% opacity at the top to 64% once the page scrolls. The change is immediate with reduced motion enabled. The public header is 60 px on mobile and 68 px on desktop. Catalog, landing and plans use public headers. The login and signup forms use their own card header. Headers show a compact flag dropdown. Settings shows always-visible light-glass panels in two columns on desktop and one column on narrower screens.
- The mobile dock compacts after scrolling past 54 px and accumulating 20 px downward. It expands after about 18 px upward and resets within 28 px of the top or on page changes. Test short pages, touch scrolling and browser back/forward.
- Collapse management forms and the sales workspace to one column on compact screens. Keep tabular overflow inside the table wrapper, and let product text wrap inside its cell. Give long lists, forms and dialogs enough bottom space for the last action above fixed chrome.

## 7. Reusable component boundaries

All current routes use the same visual hierarchy. Authenticated pages start with a `PageHeading` and put related controls, details, and records in separate light-glass `Surface` panels. Place page actions beside the heading on desktop and let them wrap below on compact layouts. Sign-in, registration, and invitation pages use the branded header and compact panel through `AuthCard`. The public home uses a centered 1170 px public header, a dark green hero, large pale heading, registration/sign-in actions, and three compact feature panels. Stack the content on mobile. Workspace links lead to the active store’s real features, and settings and access-management panels group fields by task.

Reuse the documented shell, type, panel, control, and table patterns across existing and future screens. Taste guidance supplements these decisions for alignment, hierarchy, and browser review. Its generated palettes, screen-height sections, effects, and static-export workflow do not apply to this authenticated application.

The names below are suggested implementation boundaries. Match the conventions of the new repository.

| Component | Responsibilities |
| --- | --- |
| `ThemeProvider` / `PalettePicker` | Resolve semantic tokens, restore preferences, update the root theme and browser chrome, expose the single-choice UI. |
| `BrandMark` / `BrandLockup` | Render one SVG geometry across shell, public pages and auth. Accept size and surface variant. |
| `AppShell` / `Sidebar` / `MobileDock` / `GlassHeader` | Shared route metadata, current route state, safe areas, drawer and scroll compaction. |
| `PageHeader` / `Surface` / `Button` / `StatusBadge` | Shared spacing, visual hierarchy, variants, accessible actions and status copy. |
| `Field` / `Dialog` / `Feedback` | Labels, field errors, pending state, keyboard behavior and focus restoration. |
| `SearchFilters` / `DataTable` | Filtering, compact overflow, empty state, stable row actions and numeric alignment. |
| `ProductThumbnail` / `ProductPhotoEditor` / `ProductDetail` | Item image fallback, staged image changes and a consistent presentation of specs and history. |
| `ProductForm` / `SaleForm` / `SaleSummary` | Workflow-specific data, validation and sale confirmation. Both reuse shared currency, weight, status and date formatting. |
| `DailySalesSummary` / `DailyActivity` / `PaymentBreakdown` | Dashboard totals, zero states, readable breakdowns and links to workflows when implemented. |

## 8. First milestone screens

### Sign in

Use one centered glass card, up to 455 px wide, with a dark brand strip and the form directly below. Keep email, password and submit visible without page scroll at ordinary phone viewport heights before keyboard entry. Shorter viewports or an open keyboard may require normal scrolling to keep the active field reachable. Use `E-poçt ünvanı`, `Şifrə`, and `Daxil ol`. Include show/hide password with an accessible label. Associate labels and validation with the controls. Render account creation, remember-me and recovery actions when their flows are supported. Successful authentication opens the management shell. Use the actual store-scoped authentication configured for the implementation.

### Products, inventory lookup, and add product

- In the reference, **Məhsullar** is the item record list, and **Anbar** groups current stock by purity and category and shows movements. The first milestone can reuse the product list for inventory lookup and display only the relevant destinations.
- Place **Məhsul əlavə et** in the page header. Use keyword search by product code or name, plus category, purity and status filters when available. Show a clear reset action. The full product list includes code, product thumbnail and name, category, purity, weight, reference selling price, estimate, status and a detail action. A narrower milestone table can prioritize code/name, purity, weight and availability.
- The **Yeni məhsul əlavə et** form groups identity, measurements and value. Use product code, name, category, purity, total weight and manually recorded acquisition cost for the first workflow. Version 43 also shows metal weight excluding stones, stone weight, cost per gram, labor, sample selling price, an estimate display, optional photo, stock status and a note. Include extended fields when their data rules are in scope.
- Show separate labels for `Ümumi çəki (q)`, `Xalis metal çəkisi · daşsız (q)`, and `Daş çəkisi (q)`. Purity examples are **585, 750, 999**. Sample categories include **Üzük, Sırğa, Qolbaq, Kulon, Boyunbağı, Digər**. Track each piece by a unique code. Keep duplicate code and invalid measurement errors near the relevant fields. Photo is optional for the core workflow.

### Product detail and photo

Open the item from the name or detail action. In the reference this is a glass dialog headed by item name, code, category and purity. Place a contained product photo at the top. Use compact aligned label/value rows for measurements, labor, acquisition cost, estimated selling value, actual recorded sale information where applicable, and the status pill. Provide history under a separate heading. The key status labels are `Anbardadır`, `Satılıb` and `Təmirə verilib`.

Use an actual saved photo when present and a purposeful category fallback otherwise. Version 43 uses a 44 px list thumbnail and a detail photo stage of `clamp(138px, 28vh, 216px)`, or `clamp(126px, 32vw, 174px)` on mobile. Use `object-fit: contain` for the full product image. When photo editing ships, open it **inside the existing product view**. Offer a file picker, a mobile capture entry point on compatible devices, a preview, confirm and cancel. Persist only the confirmed photo and refresh the thumbnail after success.

### New sale and confirmation

- `Yeni satış` starts the sale flow. Support entering from product detail with the item prefilled. Let the user find an in-stock item by code or name. Show item name, code, purity, weight and availability before recording the sale.
- In version 43 the wider layout pairs product lookup and a sale summary. The demo cart handles uniquely coded pieces, optional customer selection (`Müştərisiz`), payment method, discount, seller, subtotal and final amount. The first milestone may use a single-item sale. Use a labeled **actual sale amount** in that workflow. Any estimate shown alongside it is read-only context.
- Use the primary action `Satışı tamamla`, then a confirmation dialog that states the item, amount and that its status will become `Satılıb`. Use `Geri qayıt` and `Təsdiqlə və tamamla`. Preserve the user's inputs on recoverable failure and present a clear unavailable-item state if stock changed. After a successful transaction, expose the sale reference, date, amount and sold status on the item record and in sales history where implemented.
- Keep confirmation disabled during submission. The UI can display confirmed success after the backend commits the sale and availability update. Store the actual amount on the transaction so future estimate changes leave the recorded history accurate.

## 9. Remaining prototype screens

Use the following as reference when the respective work is scoped.

| Screen | Layout and behavior |
| --- | --- |
| **İcmal** | Show Bakı date and prominent `Yeni satış`. The dark sales card has today's total, completed order count, pieces sold, sold weight, and average order amount. Beside it on desktop, show payment breakdown by cash, card, transfer and mixed payment. On mobile, place the two-by-two activity strip beneath the sales card, followed by payment breakdown. Below, show quick actions, collapsible daily activity, current stock by purity, and low-stock notices. Derive counts and sums from their correct time period and transaction state. Keep a meaningful zero state. |
| **Satışlar** | Search, date and status filters. Columns cover order reference, date, item, weight, amount, payment, seller and status. Group lines from one order into its detail. Display readable `Tamamlandı`, `Ləğv edildi` and `Qaytarıldı` states. Implement return and cancellation according to confirmed operations and audit rules. |
| **Alış və mal qəbulu** | Receipt history and separate `Yeni mal qəbulu` action. Show supplier, date, item, purity, weight, cost per gram, total acquisition cost and status. Link the recorded receipt and resulting stock entry as appropriate to the agreed workflow. |
| **Anbar** | Current piece count and total weight, grouped by purity and category, with receipt, sale, return and adjustment history. A stock adjustment requires an explicit reason. |
| **Qalıq müqayisəsi** | Period type and month/quarter selector, summary of closing versus current counts and weight, item-code-level differences, and a distinction between a missing snapshot and a genuine zero. Version 43 uses sample snapshots. |
| **Müştərilər** | Customer list and purchase history. Show name, optional phone, purchase count and actual purchase total. Support unnamed customers in the sale flow. |
| **Hesabatlar** | Date presets and custom range with visible applied dates. Show completed sale totals, average, weight, payment and seller breakdowns, current stock by purity and CSV action as available. Keep range-based sales distinct from current stock. Describe sales revenue as revenue. Require cost inputs and agreed business rules to present profit. |
| **Parametrlər** | Palette picker first, then store information, calculation notes and product categories in shared panels. Keep visual preferences separate from form submission for store data. |
| **Kamera** | `Məhsul fotosu` and `Barkod` modes with capture, file selection, manual code entry, a visible reticle, and clear permission/lookup states. On a known code, show item, availability and `Satışa keç` for eligible stock. On no match, permit correction or new item creation. The prototype features local barcode reading, optional printed-digit OCR and heuristic photo suggestions. Treat photo/OCR suggestions as reviewable candidates and confirm the item before moving to sale. |
| **Müştəri kataloqu** | Public shell with a dark editorial hero, jewelry photography, category/purity filters and a photo-led grid. Use four columns on wide desktop, three at intermediate widths and two on mobile. Product cards and product detail expose available stock, photo, category, purity and weight. Keep prices and administrative data out of the public view and data payload. |
| **Landing, signup, plans** | First-time landing has one dark hero, clear `Qeydiyyatdan keç` and `Daxil ol` actions, three compact feature summaries and a demo link where appropriate. Signup reuses the auth card and may add store name. Plans use a monthly/yearly selector, desktop plan cards and comparison, and one selected card plus expandable details on mobile. Version 43 illustrates `Pulsuz`, `Başlanğıc`, `Mağaza` and `Kataloq` at illustrative monthly prices of 0, 29, 49 and 79 AZN. The yearly display in the demo uses ten monthly payments. Pricing, entitlements and annual savings require a separate business decision. |

## 10. Implementation and verification checklist

1. **Set up the foundation.** Implement semantic tokens, typography, the brand mark, buttons, fields, dialogs and responsive shell. Start with Zümrüd unless the implementation brief includes the full picker.
2. **Build one end-to-end workflow.** Implement sign-in, new product, lookup, details and sale against the Fastify/Prisma path in `PROJECT_CONTEXT.md`. Validate and review each small slice before adding another. Surface authentication, loading, empty, failed, and successful states in Azerbaijani.
3. **Review screens at representative sizes.** Check phone widths 320, 375 and 430 px, tablet widths 768 and 1024 px, and desktop around 1440 px. Verify long Azerbaijani copy, 44 px controls, keyboard reachability, contained table overflow, safe areas, drawer close, and access to the last action in a long form or modal.
4. **Check keyboard behavior.** Provide visible focus, logical order, labeled dialogs, Escape support where dismissal is appropriate, focus containment in modal dialogs, and restoration to the trigger. Validate the compact dock with a screen reader and reduced motion enabled.
5. **Verify the transaction.** Create a unique product, refresh, find it by code, record the actual amount, and verify its sale record and sold status after refreshing. Exercise duplicate code, invalid input, unavailable item, network error, and duplicate submission.
6. **Check theme parity when shipping all five.** Compare the same view at the same viewport across palettes, including sidebar, main sales card, buttons, logo, glass overlays and disabled states. Verify contrast on the final composited glass, state legibility, and preference restoration after refresh. Check that switching theme preserves layout, focus, business data, and in-progress form values.
7. **Report the slice delivered.** List completed screens and any unverified states. Review new features against the relevant rows above and the current product decisions.

### Suggested first Codex task

> Read `PROJECT_CONTEXT.md` and `DESIGN.md`. Implement the first milestone in small, reviewable steps. Start from the shared Zümrüd tokens, shell, and reusable controls. Build the sign-in and add product → find item → open details → record sale flow using the approved backend. Compare mobile and desktop against the linked prototype. Keep later prototype screens outside this first implementation task. Before finishing, run the milestone checks and summarize the result.

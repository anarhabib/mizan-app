# Misqal roadmap

Misqal is business management software for jewelry retailers, not a jewelry retailer. The current implementation supports store setup, inventory, sales, trade-ins, and owner-managed settings and staff. `misqal.az` is the intended domain; registration, DNS, and deployment are unverified. The first rollout is intended for one family-owned store at one location. The sequence after the pilot is proposed and can change based on what the store learns.

| Milestone | Status | Completion criteria |
| --- | --- | --- |
| 1. Inventory and sales foundation | Complete | Owners can set up a store and invite staff. Staff can add and find stock, record sales and trade-in payouts, and review history. The acceptance suite and business database restore drill passed. See [the milestone handoff](https://github.com/anarhabib/mizan-app/pull/11). |
| 2. Pilot readiness and rollout | Next | Verify pending UI, Settings, and sales changes. Exercise email-confirmed signup and a full isolated Auth and Storage restore, including sign-in and signed photo access. Establish daily off-machine backups and run the core workflow with the owner and salesperson on their own devices. |
| 3. Goods receipt and opening stock | Proposed | Record how stock enters inventory with receipt date, weight, purchase price per gram, and acquisition cost. Agree on supplier details, batch receiving, and opening stock entry before implementation. |
| 4. Barcode lookup | Proposed | Scan a barcode to find an item and proceed to the sale. Verify manual code entry as a fallback. Decide camera and PWA scope separately. |
| 5. Old-gold inventory | Proposed | Agree how received gold is tracked and reconciled. Record its weight and purity against the corresponding trade-in and preserve historical settlement values. |
| 6. Estimated selling prices | Proposed | Agree on the daily rate source and how purity, labor, and margin affect the estimate. Verify the calculation on representative items. |
| 7. Inventory reporting | Proposed | Agree on report scope and compare month-end and quarter-end inventory with current stock using traceable movements. |
| 8. Customer catalog | Proposed | Let customers browse selected items with photos, purity, and weight while keeping prices hidden. Agree on publication controls. |
| 9. SaaS rollout | Future | Define onboarding for independent stores, verify organization isolation, and settle plan limits and pricing before a wider rollout. |

The first pilot uses the features shipped in milestone 1. Goods receipt and barcode lookup build on the existing product and inventory workflows. Old-gold tracking builds on recorded trade-ins. Reporting depends on the inventory movements relevant to each report. The SaaS rollout follows validation of the single-store workflow.

See [product requirements](../PROJECT_CONTEXT.md), [implementation and verification status](../PROJECT_STATE.md), [UI guidance](../DESIGN.md), and [backup and restore](BACKUP_RESTORE.md).

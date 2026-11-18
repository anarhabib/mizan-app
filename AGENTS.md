Mizan — Codex Agent Instructions
Role and priorities
You are assisting the sole developer of Mizan, a jewelry-store inventory and sales management application. Favor reliable, maintainable, straightforward implementations over unnecessary abstraction. Work incrementally and preserve existing functionality and data. Optimize unnecessary model/tool usage without reducing correctness, security, or visual fidelity.
Sources of truth
- PROJECT_CONTEXT.md: confirmed product scope, business rules, architecture and feature requirements. Consult relevant sections when behavior changes.
- DESIGN.md: visual tokens, components, states, responsive behavior and motion. Read the relevant sections for UI work.
- Approved Mizan v43 Figma, linked in DESIGN.md: visual reference for approved frames and their corresponding states. The approved prototype/screenshots supplement interactions and screens not represented in Figma.
- Existing code, tests, Prisma schema and migrations: authoritative for the current implementation and database structure. Report consequential conflicts between implementation and approved requirements before changing behavior.
- docs/superpowers/plans/2026-11-17-mizan-first-milestone.md and linked approved design: current milestone scope and task sequence. Reuse them rather than replanning approved work.
- This file governs agent workflow; do not invent requirements absent from approved sources.
Development workflow
1. Define the requested change and inspect only relevant code and documentation before editing. Reuse context already available in the session.
2. Follow approved decisions, design and milestone plan. For a well-scoped task, implement directly. Revisit brainstorming or seek approval only for material unresolved decisions, subject to mandatory installed skill requirements.
3. Prefer small, reviewable changes and shared components. Avoid unrelated refactors, speculative features and infrastructure.
4. Add or update appropriate tests, especially for inventory, financial calculations, authentication and permissions. Use applicable debugging and test-driven workflows when required.
5. During iteration, run targeted checks for affected code and behavior. Before completion run the full relevant checks supported by the repository (format/lint/type checks/tests/build as applicable), and repeat checks only when subsequent changes could invalidate them. Preserve security and mandatory verification gates. State what was and was not run.
6. For each implementation task create a branch from current main (task/<number>-<short-description> for planned tasks). Once verified, commit, push and open a PR to main. Do not merge, deploy or modify production data without explicit approval.
7. Summarize the change, verified results, remaining issues, and PR link concisely.
Architecture and implementation
- Backend: Fastify; ORM: Prisma. Follow the existing schema and migrations.
- Inspect the frontend framework, package manager, language, directory conventions, validation strategy and libraries actually in use; do not assume them.
- Keep business logic out of presentation components and database access out of unrelated layers. Validate inputs at boundaries and provide consistent actionable errors.
- Avoid adding dependencies, infrastructure or abstractions without demonstrated benefit.
- Use Tailwind CSS and Lucide React for frontend UI, with the existing Mizan brand SVG and DESIGN.md tokens.
- Use English for folder names, file names and route paths. Localize user-facing text in Azerbaijani by default, with English support. Prioritize mobile-friendly workflows.
- Use AZN and explicit units (grams, gold purity, etc.). Never silently round, convert or reinterpret financial or weight values.
Data integrity and security
- Treat each jewelry item and inventory movement as business-critical data.
- Sales, returns, old-gold exchanges and stock adjustments must preserve consistent records and prevent duplicate or invalid inventory movements.
- Use database transactions for multi-step operations that must succeed or fail together. Use decimal-safe calculations for money and weights rather than imprecise floating-point arithmetic.
- Do not delete or overwrite historical inventory/financial records as a shortcut; follow documented audit/correction rules.
- Never reset a database, perform destructive schema changes or apply production migrations without explicit approval.
- Keep secrets out of code, docs and logs; use environment variables and maintain .env.example without credentials.
- Enforce permissions server-side, not solely through hidden UI controls.
Figma-driven design implementation
- Use the approved Mizan v43 Figma reference linked in DESIGN.md. When Figma MCP is available, inspect only relevant approved frames, states, components, variables and layout details. A link alone does not guarantee MCP access; if unavailable, use documented specifications and supplied screenshots rather than pretending to inspect frames.
- For an existing screen with an approved Figma frame, that frame is the visual acceptance reference. DESIGN.md remains authoritative for shared design tokens, accessibility, theme behavior and documented global rules. Use the live prototype for behavior and states missing from Figma. Report material discrepancies instead of silently overriding one source.
- For a new screen without an exact Figma frame, derive the UI from the closest approved patterns and the screen's functional requirements: typography, spacing, navigation, glass surfaces, page headings, controls, tables, forms, states and motion. Do not invent a separate style or copy an unrelated layout literally.
- Before UI implementation, inspect the relevant reference route/state and current UI. Reuse PageHeading/`PageHeader`, Surface, the shared authenticated/public shell, controls, tables and existing components according to repository conventions; do not recreate equivalents unnecessarily.
- Extract stable reusable patterns into existing tokens/components and, when needed, concise relevant sections of DESIGN.md. Reuse extracted specifications on later tasks; do not repeatedly fetch the full Figma file or reread unchanged frames unless the design changed, details are missing or a comparison requires it.
- Respect all five documented palettes, theme-dependent brand marks, Manrope typography, component states, responsiveness and motion. Theme switching changes documented visual properties only, not business behavior or unrelated layout.
- Preserve keyboard navigation, accessible names, focus visibility, contrast, reduced motion and usable mobile controls.
- Before a UI PR, check implemented views at the closest reference desktop viewport and a mobile width. Compare the correct page and state with approved frames/screenshots, fix relevant visible differences and report deliberate deviations and unverified states. Check both widths when changing shared UI.
- UI UX Pro Max is supplemental for accessibility, responsive structure, navigation and feedback; use it only when applicable and available, without letting generic suggestions replace the approved Mizan visual language. If mandatory locally configured skill instructions require a read, comply; avoid unrelated upstream reference reads.
Execution efficiency and token discipline
- Keep Sol/native inline execution as the preferred workflow for scoped development. Model/reasoning selection is controlled by the developer; these instructions do not force a model change.
- Use subagents only for substantial independent work, high-risk review, or an applicable mandatory skill gate. Give a reviewer focused requirements, changed files and diff; do not inherit the entire conversation when a fresh, focused review is possible.
- Reuse already approved plans, decisions and available conversation context. Do not reopen resolved scope, ask repeated questions or produce a new plan/document for routine tasks unless an applicable skill requires it.
- Read the smallest relevant code, document and skill sections; avoid repeatedly reading unchanged content. Re-read when changed, missing from context, uncertain or explicitly required by an applicable skill.
- Batch independent file reads/searches; constrain tool output to relevant findings and errors. Avoid verbose progress output, repeated full-repository scans and repeated builds after small visual changes.
- Compare UI with the exact reference before coding to prevent avoidable redesign-and-retest cycles.
- Use focused checks while iterating, then a single full relevant verification pass before PR; rerun affected checks when later changes invalidate results. Never skip necessary financial, security, migration or data-integrity checks merely to save tokens.
- Use Windows-compatible PowerShell commands and literal paths; avoid Bash-only expansion/quoting assumptions. Run dependent commands sequentially and inspect exit codes.
- Keep final reporting brief: changed files/behavior, tests performed, risks/unverified states and PR URL. Do not claim measured token savings without actual usage data.
Communication and session continuity
- Ask focused questions only when answers materially affect behavior, security, data, architecture or approved visual direction. Distinguish confirmed facts from assumptions.
- Explain consequential risks; do not silently extend the MVP to future SaaS or multi-tenant functionality.
- On a new session, consult only documentation relevant to the task; do not assume previous chat context persists. Check TASKS.md if present and relevant, updating it only when task status changes.
- Record approved significant decisions in an existing appropriate document; use DECISIONS.md only if adopted by the repository.
Superpowers integration
- Apply installed Superpowers skills only when available and relevant. Prefer native/inline execution for approved scoped tasks.
- These efficiency preferences do not waive mandatory skill instructions. If applicable skills require brainstorming, plan documents, fresh reads, TDD or a fresh-context review, follow those requirements and briefly identify the overhead.
- Do not claim a skill or review ran unless it actually did. Superpowers supplements rather than replaces the approved project requirements and design.
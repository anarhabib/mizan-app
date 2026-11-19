Mizan — Codex Agent Instructions
Role and priorities
You are assisting the sole developer of Mizan, a jewelry-store inventory and sales management application. Favor reliable, maintainable, straightforward implementations over unnecessary abstraction. Work incrementally and preserve existing functionality and data. Optimize unnecessary model/tool usage without reducing correctness, security, or visual fidelity.
Sources of truth
- PROJECT_CONTEXT.md: confirmed product scope, business rules, architecture and feature requirements. Consult relevant sections when behavior changes.
- DESIGN.md: visual tokens, components, states, responsive behavior and motion. Read the relevant sections for UI work.
- Existing code, tests, Prisma schema and migrations: authoritative for the current implementation and database structure. Report consequential conflicts between implementation and approved requirements before changing behavior.
- docs/ROADMAP.md defines milestone scope and sequencing. PROJECT_STATE.md tracks implementation and verification.
- This file governs agent workflow; do not invent requirements absent from approved sources.
Development workflow
1. Define the requested change and inspect only relevant code and documentation before editing. Reuse context already available in the session.
2. Follow approved decisions, design and milestone plan. For a well-scoped task, implement directly. Revisit brainstorming or seek approval only for material unresolved decisions.
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
UI implementation
- Use DESIGN.md and the existing UI as the visual reference. Review the relevant route before editing. Reuse the shared page heading, Surface, shells, controls, and tables. Document stable reusable patterns in DESIGN.md.
- Respect all five documented palettes, theme-dependent brand marks, Manrope typography, component states, responsiveness and motion. Theme switching changes documented visual properties only, not business behavior or unrelated layout.
- Preserve keyboard navigation, accessible names, focus visibility, contrast, reduced motion and usable mobile controls.
- Before a UI PR, check implemented views at the closest reference desktop viewport and a mobile width. Compare the rendered route and state with DESIGN.md and established UI patterns, fix relevant visible differences and report deliberate deviations and unverified states. Check both widths when changing shared UI.
Execution efficiency and token discipline
- Keep Sol/native inline execution as the preferred workflow for scoped development. Model/reasoning selection is controlled by the developer; these instructions do not force a model change.
- Use subagents only for substantial independent work, high-risk review. Give a reviewer focused requirements, changed files and diff; do not inherit the entire conversation when a fresh, focused review is possible.
- Reuse already approved plans, decisions and available conversation context. Do not reopen resolved scope, ask repeated questions or produce a new plan/document for routine tasks.
- Read the smallest relevant code and document sections; avoid repeatedly reading unchanged content. Re-read when changed, missing from context, uncertain or explicitly required by an applicable skill.
- Batch independent file reads/searches; constrain tool output to relevant findings and errors. Avoid verbose progress output, repeated full-repository scans and repeated builds after small visual changes.
- Review the existing UI and DESIGN.md before coding to prevent avoidable redesign-and-retest cycles.
- Use focused checks while iterating, then a single full relevant verification pass before PR; rerun affected checks when later changes invalidate results. Never skip necessary financial, security, migration or data-integrity checks merely to save tokens.
- Use Windows-compatible PowerShell commands and literal paths; avoid Bash-only expansion/quoting assumptions. Run dependent commands sequentially and inspect exit codes.
- Keep final reporting brief: changed files/behavior, tests performed, risks/unverified states and PR URL. Do not claim measured token savings without actual usage data.
Communication and session continuity
- Ask focused questions only when answers materially affect behavior, security, data, architecture or approved visual direction. Distinguish confirmed facts from assumptions.
- Explain consequential risks; do not silently extend the MVP to future SaaS or multi-tenant functionality.
- On a new session, consult only documentation relevant to the task; do not assume previous chat context persists. Check TASKS.md if present and relevant, updating it only when task status changes.
- Record approved significant decisions in an existing appropriate document; use DECISIONS.md only if adopted by the repository.

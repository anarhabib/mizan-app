# Mizan — Codex Agent Instructions

## Role and priorities
You are assisting the sole developer of Mizan, a jewelry-store inventory and sales management application. Favor reliable, maintainable, straightforward implementations over unnecessary abstraction. Work incrementally and preserve existing functionality and data.

## Sources of truth
- `PROJECT_CONTEXT.md`: product scope, business rules, architecture, and feature requirements. Consult relevant sections before implementing or changing behavior.
- `DESIGN.md`: visual design system and interaction specifications. Read before any UI/UX changes; follow its tokens, typography, components, states, responsive behavior, and motion rules.
- Existing code, tests, and database schema: inspect before proposing changes. If documentation conflicts with implementation, identify the conflict and ask before making a consequential decision.
- `docs/superpowers/plans/2026-11-17-mizan-first-milestone.md` and its linked approved design: the current milestone scope, decisions, and task sequence. Reuse the approved plan when executing its tasks.
- This file: agent workflow and engineering rules. Do not invent requirements absent from the project documents.

## Development workflow
1. Understand the requested change and inspect the relevant files before editing.
2. Reuse approved requirements, designs, and the existing milestone plan. Revisit brainstorming or scope decisions only when a material requirement is unresolved or changes, subject to mandatory skill instructions. Present decisions requiring product input before implementing.
3. For well-scoped tasks, implement directly without unnecessary ceremony.
4. Prefer small, reviewable changes; avoid unrelated refactors.
5. Add or update appropriate tests, especially for inventory, financial calculations, authentication, and permissions. Use Superpowers test-driven development and systematic debugging workflows when available and appropriate.
6. During iteration, run focused validation for the changed behavior. Before completion, run the full relevant formatting, linting, type checks, tests, and build checks. Repeat checks when later changes could invalidate their results. Preserve required tests, security checks, and skill verification gates. Report actual results and failures.
7. For each implementation task, create a new branch from current `main`, using `task/<number>-<short-description>` for planned tasks. After verifying the completed task, commit it to that branch, push the branch to `origin`, and open a pull request into `main`. This workflow is authorized for task changes. Do not merge a pull request, deploy, or change production data without explicit approval.
8. Summarize the changes, verification results, remaining steps, and the pull request link.

## Architecture and implementation
- Backend: Fastify.
- ORM: Prisma. Treat the existing Prisma schema and migrations as authoritative for the current database structure.
- Frontend: follow the framework and patterns actually present in the repository; do not assume a framework without checking.
- Use the project's existing language, package manager, directory conventions, validation approach, and libraries where practical.
- Keep business logic out of presentation components and database access out of unrelated layers.
- Validate inputs at appropriate boundaries and return consistent, actionable errors.
- Do not add dependencies, infrastructure, services, or complex abstractions unless they solve a demonstrated need.
- Favor mobile-friendly workflows and localize user-facing text for Azerbaijani (default) and English.
- Use English for folder names, file names, and route paths.
- Use Tailwind CSS for frontend styling and Lucide React for interface icons throughout the project. Follow the tokens and conventions in `DESIGN.md`.
- Use AZN and explicit units (including grams and gold purity) wherever relevant. Never silently round, convert, or reinterpret financial or weight data.

## Data integrity and security
- Treat every jewelry item and inventory movement as business-critical data.
- Sales, returns, exchanges involving old gold, and stock adjustments must maintain consistent records and prevent accidental duplication or negative inventory when the business rules prohibit it.
- Use database transactions for multi-step operations that must succeed or fail together.
- Prefer decimal-safe handling for money and measured weights; avoid floating-point arithmetic where exact values matter.
- Never delete or overwrite historical financial/inventory records as a shortcut; follow documented correction and audit rules.
- Do not make destructive schema changes, reset databases, or run production migrations without explicit approval.
- Keep credentials and secrets out of source code, documentation, and logs. Use environment variables and maintain `.env.example` without real values.
- Enforce authorization server-side, not only by hiding UI controls.

## Design implementation
- Use the owner's reference screenshots and the live Mizan prototype linked in `DESIGN.md` as the visual acceptance baseline for every UI task. Before editing, identify the matching route and state and compare its shell, layout, typography, spacing, controls, and responsive behavior with the current app.
- Before opening a UI pull request, capture the implemented screen at the closest available reference viewport and at a mobile width. Compare it side by side with the reference, fix visible mismatches within scope, and record the checked states and deliberate differences in the PR. If the live prototype is unavailable, use the supplied screenshots and report any state that could not be compared.
- Use [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/main/.claude/skills/ui-ux-pro-max) when designing, implementing, or reviewing frontend UI. Read the relevant sections of `DESIGN.md` first, then use the skill for supplemental guidance on accessibility, responsive layouts, navigation, and form feedback.
- If the skill is unavailable locally, read its upstream `SKILL.md` and the relevant references. Use Mizan's approved design decisions when skill recommendations differ.
- Follow `DESIGN.md` as the source of truth for palette selection, theme-dependent logos, component appearance, spacing, typography, and animations.
- Theme switching must change only the documented visual properties; do not alter business behavior or unrelated layout logic.
- Reuse established components and design tokens. Avoid arbitrary new colors, fonts, weights, shadows, or motion styles.
- Preserve accessibility: keyboard navigation, visible focus states, sufficient contrast, semantic controls, and reduced-motion preferences where supported.
- Check both mobile and desktop layouts when modifying shared UI.

## Communication and decision rules
- Ask focused questions only when an answer materially affects behavior, security, data, architecture, or visual direction.
- Clearly distinguish confirmed requirements from assumptions and suggestions.
- Explain risky changes and propose a safer alternative when possible.
- Keep responses concise and practical for a solo developer.
- Do not silently expand MVP scope or implement future SaaS/multi-tenant features unless requested.

## Session continuity
- At the beginning of a task, read only the documentation and code relevant to that task; do not repeatedly load entire documents without need.
- If `TASKS.md` exists, consult it for active priorities and update it only when task status actually changes.
- If a significant architectural or business decision is approved, document it in the appropriate existing project document; use `DECISIONS.md` only if the repository adopts it.
- Do not assume a previous chat's context is available. Rely on repository files and explicit instructions.

## Execution efficiency
- Prefer native/inline execution in the current session. Use subagents for substantial independent work, high-risk reviews, or reviews explicitly required by an applicable skill. Give them focused requirements and file/diff context instead of the full conversation.
- Reuse unchanged skill and repository content already available in context. Read again when it changed, context is missing or uncertain, or a skill explicitly requires a current read.
- Before UI implementation, inspect the exact approved route/state reference and existing components. Reuse established patterns and the relevant sections of DESIGN.md to prevent visual rework.
- Keep planning and decisions in existing project documents where practical. Create additional planning documents only for an uncovered need or an applicable mandatory skill requirement. Avoid repeated scope questions when the approved material already answers them.
- Batch independent reads, narrow searches and output to relevant findings, and summarize successful checks. Preserve actionable failure output.
- Use Windows-compatible PowerShell commands and literal paths. Avoid Bash brace expansion and shell quoting assumptions. Keep dependent steps sequential and check exit codes before continuing.

## Superpowers integration
- Use installed Superpowers skills when they are available and relevant, including brainstorming, writing plans, test-driven development, systematic debugging, and verification.
- Do not claim a skill was invoked unless it was actually available and used.
- Superpowers workflows complement these instructions; they do not override the project requirements, the approved design system, or explicit developer decisions.
- These efficiency preferences do not waive mandatory skill instructions. If a skill requires additional planning, a fresh read, or a review, follow it and briefly report the specific requirement when it adds overhead.

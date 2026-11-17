# Mizan — Codex Agent Instructions

## Role and priorities
You are assisting the sole developer of Mizan, a jewelry-store inventory and sales management application. Favor reliable, maintainable, straightforward implementations over unnecessary abstraction. Work incrementally and preserve existing functionality and data.

## Sources of truth
- `PROJECT_CONTEXT.md`: product scope, business rules, architecture, and feature requirements. Consult relevant sections before implementing or changing behavior.
- `DESIGN.md`: visual design system and interaction specifications. Read before any UI/UX changes; follow its tokens, typography, components, states, responsive behavior, and motion rules.
- Existing code, tests, and database schema: inspect before proposing changes. If documentation conflicts with implementation, identify the conflict and ask before making a consequential decision.
- This file: agent workflow and engineering rules. Do not invent requirements absent from the project documents.

## Development workflow
1. Understand the requested change and inspect the relevant files before editing.
2. For ambiguous or substantial work, use available Superpowers brainstorming and planning workflows. Present decisions requiring product input to the developer before implementing.
3. For well-scoped tasks, implement directly without unnecessary ceremony.
4. Prefer small, reviewable changes; avoid unrelated refactors.
5. Add or update appropriate tests, especially for inventory, financial calculations, authentication, and permissions. Use Superpowers test-driven development and systematic debugging workflows when available and appropriate.
6. Run the relevant formatting, linting, type checks, tests, and build checks that the repository supports. Report what was actually run and any failures; never claim unrun checks passed.
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

## Superpowers integration
- Use installed Superpowers skills when they are available and relevant, including brainstorming, writing plans, test-driven development, systematic debugging, and verification.
- Do not claim a skill was invoked unless it was actually available and used.
- Superpowers workflows complement these instructions; they do not override the project requirements, the approved design system, or explicit developer decisions.

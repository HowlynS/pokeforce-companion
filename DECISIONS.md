# PokeForce Companion — Decision Log

This file tracks important technical and product decisions.

## Decision Format

Each decision should include:

- Date
- Decision
- Reason
- Alternatives considered, if relevant

---

## Decisions

### 2026-07-10 — Repository name

Decision:

Use `pokeforce-companion` as the GitHub repository and local project name.

Reason:

The name is lowercase, clear, URL-safe, and matches the project identity.

---

### 2026-07-10 — Package manager

Decision:

Use `pnpm`.

Reason:

The project uses a modern JavaScript/TypeScript stack, and pnpm is fast, clean, and reliable for dependency management.

---

### 2026-07-10 — AI workflow

Decision:

Use ChatGPT for guided milestone planning and Claude Code for local code assistance.

Reason:

ChatGPT keeps the beginner-friendly step-by-step workflow controlled, while Claude Code can help edit files locally when development begins.
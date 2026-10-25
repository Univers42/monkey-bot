# Agent instructions — monkey-bot

## What this repo is

Authorized **security validation** for Univers42 organization projects:
scripts and Playwright bots that exercise form fields and other untrusted
inputs, and try to break insecure handling — **only** against org-owned apps
and local fixtures.

This is not a product app. Shipping a feature here means shipping a **probe**,
a **bot**, or a **mutant fixture** that makes security claims trustworthy.

## Non-negotiables

1. **Org scope** — targets are Univers42 projects (and local mutants/fixtures).
   No third-party or out-of-mandate production attacks.
2. **Google mutants** — avoid false positives:
   - Seed small known faults in fixtures (mutants).
   - A probe is valid only if it **kills** those mutants.
   - Report a target finding only when the probe kills the mutant **and** the
     target shows the same observable effect.
   - Drop arid/noisy mutants (logs, copy, unreachable code).
   - Hypothesis without evidence → do not report as a finding.
3. **Evidence** — every finding cites payload, sink/path, and observed effect.
4. **Bot layout** — new bots live in `src/bots/<id>/` (`index.ts`, `schema.ts`,
   `runner.ts`) and register in `src/orchestrator/registry.ts`.
5. **Devil kit** — always-on engineering rules live under
   `.claude/rules/devil/` (seeded from `.claude-deal-with-the-devil`). Prefer
   `devil` tools when present. Multi-agent discipline for the kit itself is in
   `.claude-deal-with-the-devil/AGENTS.md`.
6. **One commit per file** — when asked to commit, stage and commit exactly
   one file per commit; never bundle multiple paths. Commit only when the
   user explicitly asks.

## Cursor-specific

Project rules under `.cursor/rules/` with `alwaysApply: true` restate the
purpose, mutant gate, and commit policy for every new Cursor conversation.
Keep them in sync with this file when the mandate changes.

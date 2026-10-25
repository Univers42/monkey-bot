# monkey-bot

## Project purpose

This repository builds **authorized security-testing bots and scripts** for
Univers42 organization projects. Primary work:

- Validate form and other untrusted input fields on org apps.
- Probe for security weaknesses (XSS, injection, authz gaps, unsafe headers, etc.).
- Automate checks with Playwright/TypeScript bots under `src/bots/`.

Scope is **organization-owned targets and local fixtures only**. Do not attack
third-party or production systems outside that mandate.

## Google mutants (anti–false-positive)

Every finding must survive the Google mutation-testing discipline:

1. **Seed mutants** — introduce small, known faults (broken validators, reflected
   sinks, missing auth checks) in controlled fixtures or test doubles.
2. **Kill mutants** — a probe only counts if it detects those seeded faults.
3. **No orphan positives** — do not report a vulnerability on a target unless the
   same probe kills the matching mutant *and* the target shows the same
   observable signal (error, execution, data leak, privilege change).
4. **Suppress arid mutants** — ignore mutations in logs, messages, dead code, or
   other noise that cannot represent a real security fault.
5. **UNKNOWN = FAIL** — a scanner hit or heuristic without a demonstrated path
   is a hypothesis, not a finding.

## Agent defaults

- Prefer adding/extending bots under `src/bots/<id>/` (schema + runner + index)
  and registering them in `src/orchestrator/registry.ts`.
- Prefer evidence (command + output, payload + response) over narrative.
- High-blast or irreversible actions need an explicit human trigger
  (see devil `rules/risk.md`).
- **One commit per file** — when asked to commit, one path per commit; never
  bundle. Commit only on explicit user request.

<!-- devil:start -->
## The devil kit

Installed as the Claude Code plugin `devil`.

- `/devil:guide` lists every command, workflow, skill and agent with its stage.
- `devil <tool>` runs a tool: `devil digest`, `devil quality --no-audit`, `devil selfcheck`.
- Its 12 always-on rules are seeded under `.claude/rules/devil/` and load every session.
- After a plugin update, run `/devil:setup --apply` to re-seed them.
<!-- devil:end -->

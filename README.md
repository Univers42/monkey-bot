# monkey-bot

Authorized **security-testing bots** for Univers42 organization projects.

Bots exercise form and other untrusted inputs, and try to break insecure
handling — only against org-owned apps and local mutant fixtures. Findings
use the **Google mutants** discipline so probes that cannot kill seeded faults
do not report target positives.

## Quick start

```bash
pnpm install
cp .env.example .env
cp config/targets.local.json.example config/targets.local.json   # edit real org URLs
pnpm test
pnpm test:calibration   # requires Chromium; hard mutant gate
pnpm run dev
```

Server: `http://localhost:3000`. Docs: `GET /docs`.

```bash
docker compose up --build
```

## Target URLs

| File | Role |
| --- | --- |
| `config/targets.example.json` | Documented template (committed) |
| `config/targets.json` | Default targets including mutant-lab baselines |
| `config/targets.local.json.example` | Template for real org URLs + auth |
| `config/targets.local.json` | Local overrides (**gitignored**) |

`mutant:<file.html>` URLs resolve to seeded fixtures under `src/mutants/fixtures/`.
Optional env: `MONKEY_BOT_TARGETS_FILE`. Auth credentials use env vars named in
the target `auth.usernameEnv` / `auth.passwordEnv` (never commit secrets).

```bash
curl -s http://localhost:3000/targets
curl -s -X POST http://localhost:3000/run/form-xss \
  -H "Content-Type: application/json" \
  -d '{"targetId":"mutant-lab-reflected-xss","writeArtifact":true}'
```

Baseline script (writes `./artifacts/`):

```bash
pnpm baseline:form-xss
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health probe |
| `GET` | `/bots` | List bots |
| `GET` | `/targets` | List configured target URLs |
| `GET` | `/mutants/:file.html` | Serve a mutant fixture over HTTP |
| `POST` | `/run` | Run default bot (`smoke`) |
| `POST` | `/run/:botId` | Run a specific bot |
| `POST` | `/run/suite` | Calibrate/run security bots for a target |

### Suite

```bash
curl -s -X POST http://localhost:3000/run/suite \
  -H "Content-Type: application/json" \
  -d '{"targetId":"mutant-lab-reflected-xss","writeArtifact":true}'
```

### Bots

| id | Role |
| --- | --- |
| `smoke` | Browser smoke check |
| `form-xss` | Reflected + attribute XSS probe with mutant calibration |

## Mutants

Calibration must **kill** `reflected-xss` and `attr-xss`, leave escaped controls
alone, and treat `arid-log-only` as noise. If calibration fails, `probeTrusted`
is false and target findings are suppressed (`UNKNOWN = FAIL`).

## Layout

```text
config/                 # target URLs
artifacts/              # gitignored evidence JSON
src/
  findings/types.ts     # shared finding schema
  config/targets.ts
  lib/{chromium,auth,artifacts}.ts
  bots/{smoke,form-xss}/
  mutants/fixtures/
  orchestrator/
```

## MCP (Cursor) — Prismatica / vuln probes

Project MCP config: [`.cursor/mcp.json`](.cursor/mcp.json).

| Server | Role |
| --- | --- |
| `monkey-bot-security` | Mutant calibration, form-XSS probes, Prismatica scan, header checks |
| `playwright` | Browser automation MCP for recon |

After reload/restart Cursor, enable the servers under **Settings → MCP**. Tools:

- `calibrate_mutants` — Google mutants gate
- `list_targets` — configured targets/bots
- `probe_form_xss` — probe `targetId` or URL
- `check_security_headers` — header observations (not findings alone)
- `scan_prismatica` — calibrate + every `prismatica-*` target

Run the server locally:

```bash
pnpm mcp
```

Prismatica targets live in `config/targets.local.json` (gitignored).

## Agent rules

See `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/`.

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
cp config/targets.example.json config/targets.local.json   # edit real org URLs here
pnpm run dev
```

Server: `http://localhost:3000`. Docs: `GET /docs`.

```bash
docker compose up --build
```

## Target URLs

Named targets live under `config/`:

| File | Role |
| --- | --- |
| `config/targets.example.json` | Documented template (committed) |
| `config/targets.json` | Default targets (committed placeholders) |
| `config/targets.local.json` | Local overrides for real org URLs (**gitignored**) |

Optional env: `MONKEY_BOT_TARGETS_FILE` (path to a JSON file). When unset,
`targets.json` is loaded and merged with `targets.local.json` if present.

List configured targets:

```bash
curl -s http://localhost:3000/targets
```

Run a bot by target id:

```bash
curl -s -X POST http://localhost:3000/run/form-xss \
  -H "Content-Type: application/json" \
  -d '{"targetId": "local-app"}'
```

Request-body `url` / selectors override the named target when both are set.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health probe |
| `GET` | `/bots` | List bots |
| `GET` | `/targets` | List configured target URLs |
| `POST` | `/run` | Run default bot (`smoke`) |
| `POST` | `/run/:botId` | Run a specific bot |

### Bots

| id | Role |
| --- | --- |
| `smoke` | Browser smoke check (title, console errors, failed requests) |
| `form-xss` | Reflected XSS form probe with mutant calibration |

### `form-xss` — calibrate only

```bash
curl -s -X POST http://localhost:3000/run/form-xss \
  -H "Content-Type: application/json" \
  -d '{"calibrateOnly": true}'
```

Calibration must **kill** `reflected-xss`, leave `escaped-echo` alone, and treat
`arid-log-only` as noise. If calibration fails, `probeTrusted` is false and
target findings are suppressed (`UNKNOWN = FAIL`).

### `form-xss` — target + mutants

```bash
curl -s -X POST http://localhost:3000/run/form-xss \
  -H "Content-Type: application/json" \
  -d '{
    "targetId": "local-app",
    "timeoutMs": 20000
  }'
```

A finding is reported only when:

1. the must-kill mutant was killed, and
2. the target shows the same oracle (`window.__MB_XSS__ === token`).

## Layout

```text
config/
  targets.example.json
  targets.json
  targets.local.json   # gitignored local overrides
src/
  config/targets.ts    # loader + resolveTarget
  bots/
    smoke/
    form-xss/
  mutants/
    fixtures/
    catalog.ts
  lib/chromium.ts
  orchestrator/
```

### Add a bot

1. Create `src/bots/<id>/{index,schema,runner}.ts`.
2. Pair it with a mutant fixture under `src/mutants/fixtures/` when it makes
   security claims.
3. Register it in `src/orchestrator/registry.ts`.
4. Call `POST /run/<id>`.

## Agent rules

Cursor/Claude always-on guidance lives in `AGENTS.md`, `CLAUDE.md`, and
`.cursor/rules/`. Devil kit rules are seeded under `.claude/rules/devil/`.

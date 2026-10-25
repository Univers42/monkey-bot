# monkey-bot

Authorized **security-testing bots** for Univers42 organization projects.

Bots exercise form and other untrusted inputs, and try to break insecure
handling — only against org-owned apps and local mutant fixtures. Findings
use the **Google mutants** discipline so probes that cannot kill seeded faults
do not report target positives.

## Quick start

```bash
pnpm install
pnpm run dev
```

Server: `http://localhost:3000`. Docs: `GET /docs`.

```bash
docker compose up --build
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health probe |
| `GET` | `/bots` | List bots |
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
    "url": "http://localhost:3000/../path-to-org-app",
    "formSelector": "form",
    "fieldSelector": "input[name=q]",
    "timeoutMs": 20000
  }'
```

A finding is reported only when:

1. the must-kill mutant was killed, and
2. the target shows the same oracle (`window.__MB_XSS__ === token`).

## Layout

```text
src/
  bots/
    smoke/           # smoke bot
    form-xss/        # XSS probe + mutant gate
  mutants/
    fixtures/        # seeded faults + controls (HTML)
    catalog.ts
  lib/chromium.ts
  orchestrator/      # registry + runBot
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

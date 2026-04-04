# monkey-bot
This project main's goal is to create a bot to automate testing and security issues for the rest of our projects

## Quick start (TypeScript + Playwright + Docker)

This project now uses Vite as the server runtime (dev and production preview).

Project runtime values are loaded from .env for the server port and Chromium path.

The repository now has two execution surfaces:
- HTTP bot server under `src/` for `/run/:botId`
- terminal QA framework at the repository root for reusable scenario suites

### 1. Install dependencies locally

```bash
pnpm install
```

### 2. Run in development mode

```bash
pnpm run dev
```

Server runs on `http://localhost:3000`.

### Make shortcuts

The repository also ships a `Makefile` for common local and Docker workflows.

Common local commands:

```bash
make install                                   # install dependencies and create .env if needed
make test                                      # run lint and typecheck
make qa-doctor                                 # validate the local QA target and browser setup
make qa-wave-1                                 # run the default wave-1 suite locally
make qa-run-scenario SCENARIO=login-success    # run one local QA scenario
```

Common Docker commands:

```bash
make docker-images                                                                   # build the app image and the qa-runner image
make docker-qa-doctor                                                                # validate the QA environment from inside the qa-runner container
make docker-qa-wave-1                                                                # run the default wave-1 suite in Docker
make docker-qa-scenario SCENARIO=shared-document-permissions CONCURRENCY=coordinated ACTORS=2  # run one Docker QA scenario with explicit concurrency
```

Useful variables:

- `PROJECT` defaults to `notion-like`
- `ENV` defaults to `local`
- `SUITE` defaults to `wave-1`
- `SCENARIO` selects a single scenario
- `CONCURRENCY`, `ACTORS`, `WORKERS`, `RETRIES`, and `QA_EXTRA_ARGS` let you customize QA runs

For the `notion-like` adapter, the default QA target is now `http://localhost:3002`.

### Normal test flow

For a normal day-to-day test run, this is the recommended order:

1. Install dependencies and ensure `.env` exists:

```bash
make install
```

2. Start the local app in one terminal:

```bash
make dev
```

3. In another terminal, check that the QA environment is ready:

```bash
make qa-doctor
```

4. Run the default suite:

```bash
make qa-wave-1
```

5. If you only need one scenario, run it directly:

```bash
make qa-run-scenario SCENARIO=login-success
```

6. Review the latest report:

```bash
make qa-report
```

If local Playwright/Chromium is not available, use the Docker flow instead:

```bash
make docker-qa-doctor
make docker-qa-wave-1
make docker-qa-scenario SCENARIO=login-success
```

### 3. Build and run the demo app with Docker

```bash
docker compose up --build
```

This uses a multi-stage Alpine-based build for the demo app:
- `deps` stage for full dependency installation
- `build` stage for TypeScript compilation
- `prod-deps` stage for production-only dependencies
- `runtime` stage with a non-root user and system Chromium for Playwright

### 4. Run the QA runner in Docker

The repository now also ships a dedicated `qa-runner` image based on the official Playwright runtime. It is intended for CLI scenarios, not for serving the app.

Build it:

```bash
docker compose --profile qa build qa-runner
```

Run the wave-1 suite against the demo app container:

```bash
docker compose up -d app
docker compose --profile qa run --rm qa-runner \
  run --project notion-like --suite wave-1 --env local
```

Run a single scenario:

```bash
docker compose --profile qa run --rm qa-runner \
  run --project notion-like --scenario login-success --env local
```

Outputs are written to:

- `reports/<project>/latest`
- `reports/<project>/<runId>`
- `artifacts/<project>/<runId>`

### 5. API endpoints

- Swagger UI: `GET /docs`
- `GET /health` : health probe
- `GET /bots` : lists available bots
- `POST /run` : runs the default bot (`smoke`)
- `POST /run/:botId` : runs a specific bot

Available bots right now:
- `smoke`: generic page smoke diagnostics
- `login`: legacy alias of `login-smoke`
- `login-smoke`: normal login flow
- `login-validation`: input validation and malformed payloads
- `login-security`: abuse, masking, protected routes, replay, malformed requests
- `login-session-lifecycle`: persistence, reload, tabs, logout, restart behavior
- `login-multiuser-realtime`: concurrent users, shared tabs, websocket auth checks

Example request:

```bash
curl -X POST http://localhost:3000/run/smoke \
    -H "Content-Type: application/json" \
    -d '{
        "url": "https://example.com",
        "waitForSelector": "h1",
        "timeoutMs": 20000
    }'
```

Example response:

```json
{
    "ok": true,
    "result": {
        "title": "Example Domain",
        "finalUrl": "https://example.com/",
        "consoleErrors": [],
        "failedRequests": []
    }
}
```

Example login suite request:

```bash
curl -X POST http://localhost:3000/run/login-smoke \
    -H "Content-Type: application/json" \
    -d '{
        "url": "https://example.com/login",
        "credentials": {
            "username": "demo-user",
            "password": "demo-pass"
        },
        "selectors": {
            "username": "input[name=email]",
            "password": "input[name=password]",
            "submit": "button[type=submit]",
            "success": "[data-test=dashboard]"
        },
        "expectations": {
            "postLoginUrlIncludes": "/app",
            "protectedUrl": "/app"
        },
        "timeoutMs": 20000
    }'
```

## Login page for bot testing

This repo now includes a local login page built with the `vendor/libcss` submodule styles.

- URL: `http://localhost:3000/`
- Demo credentials: `demo-user` / `demo-pass`
- Built-in success selector: `[data-test=dashboard]`

Example request against the local login page:

```bash
curl -X POST http://localhost:3000/run/login-smoke \
    -H "Content-Type: application/json" \
    -d '{
        "url": "http://localhost:3000/",
        "credentials": {
            "username": "demo-user",
            "password": "demo-pass"
        },
        "selectors": {
            "success": "[data-test=dashboard]"
        },
        "timeoutMs": 20000
    }'
```

The structured payload is the preferred shape for the new suite. The legacy `login` alias still accepts flat fields such as `username`, `password`, and `successSelector`.

## Bot architecture

The project uses a bot registry/orchestrator model so multiple bots can live in the same repository with low coupling.

Current structure:

```text
src/
    bots/
        login/
            index.ts      # exports the login bot family
            schema.ts     # shared suite input parsing and validation
            shared.ts     # browser/session/artifact helpers
            runner.ts     # suite runners and scenario reporting
        smoke/
            index.ts      # bot metadata + contract implementation
            schema.ts     # input parsing and validation
            runner.ts     # Playwright logic
    orchestrator/
        errors.ts       # typed orchestration errors
        registry.ts     # bot registration map
        runBot.ts       # listBots + runBotById
        types.ts        # shared bot contract
```

To add a new bot:

1. Create `src/bots/<your-bot>/index.ts`, `schema.ts`, and `runner.ts`.
1. Register it in `src/orchestrator/registry.ts`.
1. Call it with `POST /run/<your-bot-id>`.

The login family now lives under `src/bots/login/` and shares helpers while exposing multiple ids:

1. `login-smoke`
1. `login-validation`
1. `login-security`
1. `login-session-lifecycle`
1. `login-multiuser-realtime`

## QA CLI framework

The reusable terminal framework lives directly in the repository root and is organized like this:

```text
core.ts                     # runner, contracts, concurrency, result model
browser.ts                  # Playwright harness and artifact capture
reporters.ts                # terminal, JSON, JUnit and HTML outputs
cli.ts                      # qa-bots command line
projects/
    index.ts                # project registry
    notion-like/
        index.ts            # project entrypoint
        config.ts           # routes, selectors, feature flags
        types.ts            # project contracts
        doctor.ts           # environment checks
        actors/
        adapters/
        assertions/
        fixtures/
        scenarios/
```

Main commands:

```bash
pnpm run qa-bots -- list --project notion-like --scenarios
pnpm run qa-bots -- list --project notion-like --suites
pnpm run qa-bots -- doctor --project notion-like
pnpm run qa-bots -- run --project notion-like --suite wave-1 --env local
pnpm run qa-bots -- run --project notion-like --scenario login-success --headed
pnpm run qa-bots -- run --project notion-like --scenario shared-document-permissions --concurrency coordinated --workers 1
pnpm run qa-bots -- report --input reports/notion-like/latest/results.json
```

Supported first-wave scenarios:

- `login-success`
- `signup-validation`
- `session-lifecycle`
- `first-workspace-creation`
- `document-crud`
- `block-editor-core`
- `autosave`
- `private-document-access`
- `shared-document-permissions`
- `smoke-core`

Concurrency modes:

- `isolated`
- `coordinated`
- `conflict`
- `swarm` reserved for a future high-concurrency module

Expected project env vars for the default adapter:

```bash
QA_NOTION_BASE_URL=http://localhost:3002
QA_NOTION_OWNER_EMAIL=owner@example.test
QA_NOTION_OWNER_PASSWORD=owner-pass
QA_NOTION_COLLABORATOR_EMAIL=collab@example.test
QA_NOTION_COLLABORATOR_PASSWORD=collab-pass
QA_NOTION_FRESH_EMAIL=fresh@example.test
QA_NOTION_FRESH_PASSWORD=fresh-pass
```

The adapter also accepts selector overrides such as `QA_NOTION_SEL_LOGIN_FORM`, `QA_NOTION_SEL_EDITOR_ROOT` and feature flags such as `QA_NOTION_FEATURE_SHARING=0`.


# 1. Browser automation
## Tools
- Plawright (recommended starting point by AI)
- Puppeteer
- Selenium

## What to learn
- Opening pages
- Clicking buttons / filling forms
- Waiting for elements
- Handling authentication flows

# 2. Frontend testing concepts
## Key ideas
- End to end (E2E) testing
- Assertions
- Test runners
## Tools
- Playwright Test
- Cypress

# 3. Error detection
## What bot should do
- Detect broken UI flows
- Catch JS errors
- Identify missing elements or failed requests
## Learn
- Capturing console errors
- Monitoring network requests
- Handling timeouts and failures

# 4. Security testing (this is a separate skill)
## Basics
- OWASP Top 10 (must-know vulnerabilities)
- XSS (cross-site scripting)
- SQL injection
- CSRF
- Authentication flaws
## Tools
- OWASP ZAP (great beginner-friendly scanner)
- Burp Suite
## Languages
- TypeScript → End-to-end bots and browser bots
- Python → Helper scripts and input generation
- Go → Concurrent stress and massive sockets
## What bot can do
- Inject payloads into forms
- Check if scripts execute (XSS)
- Detect insecure headers
- Crawl pages for vulnerabilities

# 5. Combine automation + security
## Use Playwright to:
- Navigate and interact with the app
- Integrate:
- Security payloads (e.g., test inputs)
- External scanners (ZAP API)
## Example idea
- Bot logs into Notion-like app
- Creates pages with malicious inputs
- Checks if anything breaks or executes unexpectedly

# 6. Suggested learning path (simple roadmap)
1. Learn Playwright (automate a login + form)
1. Add assertions (test results)
1. Capture errors (console + network)
1. Study OWASP Top 10
1. Try OWASP ZAP manually
1. Integrate security tests into your bot

# 7. A realistic first project (MVP)
- Opens your app
- Logs in
- Creates a page
- Inputs weird/malicious text
- Checks:
    - Did it crash?
    - Did scripts run?
    - Any console errors?

# 8. Programming Languages
- TypeScript for frontend interaction and testing
- Python for security research scripts

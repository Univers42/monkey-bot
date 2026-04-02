# monkey-bot
This project main's goal is to create a bot to automate testing and security issues for the rest of our projects

## Quick start (TypeScript + Playwright + Docker)

This project now uses Vite as the server runtime (dev and production preview).

Project runtime values are loaded from .env for the server port and Chromium path.

### 1. Install dependencies locally

```bash
pnpm install
```

### 2. Run in development mode

```bash
pnpm run dev
```

Server runs on `http://localhost:3000`.

### 3. Build and run with Docker

```bash
docker compose up --build
```

This uses a multi-stage Alpine-based build:
- `deps` stage for full dependency installation
- `build` stage for TypeScript compilation
- `prod-deps` stage for production-only dependencies
- `runtime` stage with a non-root user and system Chromium for Playwright

### 4. API endpoints

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

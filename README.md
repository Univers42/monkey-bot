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

## Bot architecture

The project uses a bot registry/orchestrator model so multiple bots can live in the same repository with low coupling.

Current structure:

```text
src/
    bots/
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
## What bot can do
- Inject payloads into forms
- Check if scripts execute (XSS)
- Detect insecure headers
- Crawl pages for vulnerabilities
## And also
### Authentication and session

Test soft brute force, token reuse, session expiration, incomplete logout, and user switching without invalidating state.
Attempt to bypass protected screens by entering directly through private paths.
### Access control

Perform actions with one user on another's resources.
Change IDs, UUIDs, slugs, or parameters to detect IDORs and permission failures.
### Malicious inputs

Send large texts, unusual characters, HTML, Markdown, broken JSON, unexpected types, arrays where expected strings, null, or negative numbers.
Look for validations only on the frontend but not on the backend.
### XSS and dangerous rendering

Test if comments, names, descriptions, or rich fields execute content when displayed.
Review previews, tooltips, toasts, tables, and modals.

### Injection

Cases for SQL/NoSQL/command injection involving complex searches, filters, sorting, exports, or endpoints.
Also templates, expressions, or internal search engines.
### CSRF and Sensitive Actions

Attempting authenticated actions without explicit user intent.
Reviewing creation, editing, deletion, email/password changes, and invitations.
### Rate Limiting and Abuse

Login spam, registration spam, password recovery spam, search spam, file upload spam, and mass record creation spam.
Measure when the system responds slowly, when it blocks, and whether it blocks by IP address, user, or session.
### Race Conditions

Triggering the same action multiple times in parallel: purchase, reservation, accept invitation, use coupon, delete/edit.
Looking for duplicates, impossible states, and inconsistent balances.
### File Uploads

Large files, duplicate extensions, deceptive MIME types, strange names, corrupted images, SVG files, and ZIP files.
Checking if the system stores, processes, or serves files insecurely. 
### API abuse

Calling endpoints outside the normal frontend flow.
Repeating old requests, changing HTTP methods, removing expected headers, manipulating pagination/filters.
### Business logic

Skipping required flow steps.
Creating invalid states: payment without order, invitation accepted twice, object deleted but still editable.
### Frontend tampering

Altering localStorage, sessionStorage, flags, client roles, hidden parameters, disabled forms.
Confirming that the server does not trust anything from the browser.
### Aggressive crawling

Traversing all routes, including old, hidden, or indirectly linked ones.
Detecting orphaned pages, legacy endpoints, and exposed assets.
### Errors and leaks

Forcing failures to see if stack traces, table names, keys, internal routes, or infrastructure details are exposed.
Reviewing different error messages between "user does not exist" and "incorrect password."
### Headers and Browser

Review CSP, HttpOnly/Secure/SameSite cookies, CORS, framing, and sensitive content caching.
Check behavior across multiple tabs and cross-sessions.
### Resilience

Simulate slow network conditions, incomplete requests, inappropriate refreshes, retries, duplicates, and partial connection loss.
Look for state corruption in the UI and backend.
### Bot Observability

It shouldn't just "attack": it should classify the result as blocked, vulnerable, inconsistent, degraded, or suspicious.
Save minimal evidence: route, abstract payload, response, impact, and severity.

### Useful Architecture for the Bot:

- Crawler to discover routes and forms.
- Mutator to generate unusual or malicious inputs.
- Scenario runner for real user flows.
- Abuse engine for parallelism, repetition, and state manipulation.
- Oracle to determine if something failed in an interesting way. 
- Reporter to group findings by severity and reproducibility.


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
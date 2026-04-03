# src

This directory contains the HTTP bot surface of the repository.

Its responsibility is different from the CLI QA framework that lives at the repository root. The code in `src/` powers the bot server exposed through routes such as `/bots`, `/run`, `/run/:botId`, and `/docs`, while the root-level framework (`cli.ts`, `core.ts`, `browser.ts`, `projects/`) is used to execute larger reusable scenario suites from the terminal.

## What lives here

`src/` contains three main concerns:

- bot implementations that can be called through the HTTP API
- orchestration code that resolves a bot by id and executes it
- the demo browser UI used as a local target for bot development and testing

## How it fits into the request flow

The HTTP routes are mounted by the Vite middleware defined in [vite.config.ts](/home/settes/cursus/trascendence/monkey-bot/vite.config.ts). That middleware delegates into `src/`:

1. it receives a request such as `POST /run/login-smoke`
2. it calls [runBot.ts](/home/settes/cursus/trascendence/monkey-bot/src/orchestrator/runBot.ts)
3. the orchestrator resolves the bot from [registry.ts](/home/settes/cursus/trascendence/monkey-bot/src/orchestrator/registry.ts)
4. the selected bot validates input and executes its Playwright logic
5. the HTTP layer returns the bot result as JSON

That means `src/` owns bot behavior and bot selection, but not the server bootstrap itself.

## Directory and file roles

### `bots/`

This directory contains the bot families exposed by the HTTP API.

- Each bot family lives in its own subdirectory.
- A bot usually exposes metadata, input parsing, and execution logic.
- Bot code should focus on one bot family at a time and stay independent from other families as much as possible.

Current families include:

- `smoke/` for generic page diagnostics
- `login/` for login-focused suites such as smoke, validation, security, session lifecycle, and multi-user checks

### `orchestrator/`

This directory contains the server-side bot coordination layer.

- [types.ts](/home/settes/cursus/trascendence/monkey-bot/src/orchestrator/types.ts) defines the bot contract
- [registry.ts](/home/settes/cursus/trascendence/monkey-bot/src/orchestrator/registry.ts) registers the available bots
- [runBot.ts](/home/settes/cursus/trascendence/monkey-bot/src/orchestrator/runBot.ts) resolves and executes a bot by id
- [errors.ts](/home/settes/cursus/trascendence/monkey-bot/src/orchestrator/errors.ts) defines typed runtime errors for the API surface

If you add a new HTTP bot, this is the layer that exposes it.

### `main.ts`

This is the browser entry point for the local demo page.

- It powers the login lab shipped with the repo.
- It is useful as a stable local target for bot development.
- It is not the HTTP API entry point.

### `styles/`

This directory contains styles used by the local demo UI.

- Right now it supports the login lab used for manual checks and local bot validation.

### `swagger.ts`

This file contains the OpenAPI document for the HTTP bot server.

- It describes the available endpoints, request payloads, and response shapes exposed by the Vite middleware.

### `bot.ts`

This file is a small compatibility export around the default smoke bot.

- It exists as a narrow legacy-facing entry point.
- New bot families should be added under `src/bots/` and registered through the orchestrator.

### `style-modules.d.ts`

This file provides TypeScript declarations for stylesheet imports used by the frontend build.

## Relationship with the rest of the repository

This repository has two execution surfaces:

### `src/` HTTP bot server

Use this when:

- you want to trigger bots through HTTP
- you want a lightweight bot API
- you want Swagger-documented endpoints
- you want to run focused bot checks such as smoke or login-related flows

### Root-level QA framework

Use the root framework when:

- you want to run reusable scenario suites from the terminal
- you need project adapters such as `projects/notion-like`
- you need concurrency modes like `isolated`, `coordinated`, or `conflict`
- you need run reports, artifacts, doctor checks, and scenario-level orchestration

Both layers use TypeScript and Playwright, but they solve different problems:

- `src/` is a bot API surface
- the root framework is a reusable QA execution platform

## Practical rule for contributors

- Put HTTP-exposed bot families in `src/bots/`
- Put bot registration and bot dispatch logic in `src/orchestrator/`
- Put demo frontend assets in `src/main.ts` and `src/styles/`
- Put reusable CLI QA framework code at the repository root, not inside `src/`

If a feature needs to be callable through `/run/:botId`, it belongs in `src/`. If it belongs to the generic terminal runner or project-based scenarios, it should live in the root QA framework instead.

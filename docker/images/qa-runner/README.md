# qa-runner image

This directory contains the Docker image used to run the terminal QA framework.

The `qa-runner` image is not the application image. Its purpose is to execute the root-level QA CLI (`qa-bots`) inside a Playwright-ready container, with browsers and Linux runtime dependencies already available.

## What lives here

### `Dockerfile`

Builds the `qa-runner` image.

- installs project dependencies in a Node-based dependency stage
- uses the official Playwright runtime image for execution
- copies the QA framework entry files from the repository root
- copies `projects/` so project adapters and scenarios are available
- creates report and artifact directories
- runs as the non-root `pwuser`

### `entrypoint.sh`

Defines the container entrypoint.

- ensures artifact and report directories exist
- delegates execution to `pnpm run qa-bots -- ...`
- keeps the container logic minimal so orchestration stays in TypeScript

## What this image is for

Use this image when you want:

- reproducible Playwright execution in Docker
- a QA runtime with browsers already installed
- scenario execution through the terminal framework
- reports and artifacts written to mounted host volumes

Typical use cases:

- `doctor`
- `list`
- `run --suite ...`
- `run --scenario ...`
- `report --input ...`

## What this image is not for

This image does not serve the web app itself.

- the application runtime is built from the repository root `Dockerfile`
- the `qa-runner` image only executes QA commands against a target application

In normal Docker usage, the app and the runner are coordinated through `docker-compose.yml`.

## Runtime inputs

The image expects or supports these environment values:

- `QA_NOTION_BASE_URL` to point the `notion-like` adapter at the target host
- `ARTIFACTS_DIR` for Playwright artifacts
- `REPORTS_DIR` for generated reports
- `PLAYWRIGHT_DOCKER=1` to signal Docker-based browser execution

## Normal execution flow

The usual path is:

1. build the app image
2. build the `qa-runner` image
3. start the app
4. run `qa-bots` inside `qa-runner`
5. collect reports from mounted `reports/` and `artifacts/`

Examples:

```bash
docker compose --profile qa build qa-runner
docker compose up -d app
docker compose --profile qa run --rm qa-runner doctor --project notion-like --env local
docker compose --profile qa run --rm qa-runner run --project notion-like --suite wave-1 --env local
```

## Relationship with the rest of the repository

- root-level QA framework files such as `cli.ts`, `core.ts`, `browser.ts`, and `reporters.ts` provide the execution logic
- `projects/` provides the project-specific adapters and scenarios
- `docker-compose.yml` wires this image to the target application and host-mounted outputs

If you need to change how QA runs in Docker, this directory is the place to update the container packaging layer, not the scenario logic itself.

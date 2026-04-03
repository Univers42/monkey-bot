# notion-like

`notion-like` is the project adapter for collaborative web apps with a product shape similar to Notion.

Its purpose is to let the QA framework run reusable scenarios against a concrete application without hardcoding product details into the core runner. The directory defines how the framework should understand routes, selectors, users, features, domain actions, and scenario expectations for this family of apps.

## How this project is composed

The project is assembled from four main layers:

- `config.ts` loads environment-driven routes, selectors, feature flags, behavior toggles, and test users.
- `adapters/` turns raw browser interactions into reusable domain operations such as login, workspace creation, document editing, sharing, and save-state checks.
- `scenarios/` defines executable business flows by coordinating actors, phases, adapters, and assertions.
- `doctor.ts` validates that the target environment is usable before a full run starts.

The entry point is [index.ts](/home/settes/cursus/trascendence/monkey-bot/projects/notion-like/index.ts). It creates the project config, builds the adapter, registers the scenarios, and exposes the doctor checks used by the CLI.

## Directory roles

### `actors/`

This directory defines the actors that participate in scenarios.

- An actor represents a role in the run, not a browser implementation detail.
- Examples: owner, collaborator, anonymous user, or fresh user.
- Actors should stay small and declarative.
- Navigation, assertions, and business actions do not belong here.

### `adapters/`

This directory contains the domain-facing API for the project.

- Adapters hide selectors, routes, and repeated UI behavior behind stable methods.
- They are the main boundary between scenario logic and Playwright operations.
- Each adapter focuses on one area of the product, such as auth, workspace, documents, sharing, or save-state behavior.
- If the app changes its UI structure, adapters should absorb most of that change.

### `assertions/`

This directory groups reusable checks.

- Assertions express expected business or UI outcomes in a readable form.
- They help scenarios stay focused on intent instead of repeating low-level `ctx.expect(...)` logic.
- Assertions should verify state, not perform setup or navigation.

### `fixtures/`

This directory stores reusable scenario data.

- It contains test users, invalid payloads, and any stable dataset shared across scenarios.
- Fixtures should stay mostly declarative.
- Environment-dependent values should come from configuration or env variables, not from hardcoded scenario logic.

### `scenarios/`

This directory contains the executable QA flows for the project.

- Each file defines one scenario such as `login-success`, `session-lifecycle`, or `document-crud`.
- Scenarios coordinate actors, phases, adapters, and assertions.
- Shared scenario helpers live in `helpers.ts`.
- Scenario registration lives in `scenarios/index.ts`.

## Main files

### `index.ts`

Creates the project runtime used by the CLI.

- Builds config.
- Builds adapters.
- Registers scenarios.
- Exposes doctor checks.

### `config.ts`

Defines the project-level configuration contract for this app family.

- Base URL and routes.
- Stable selectors.
- Feature flags.
- Behavioral expectations.
- Test users.
- Optional API endpoints.

### `types.ts`

Defines the local TypeScript contracts for the project.

- User shape.
- Project config shape.
- Adapter interfaces.
- Scenario aliases specialized for `notion-like`.

### `doctor.ts`

Defines pre-run environment checks.

- Browser availability.
- Base URL reachability.
- Enabled feature summary.
- Loaded test-user summary.

## Design rules for this project

- Keep scenario intent in `scenarios/`, not inside adapters.
- Keep browser mechanics in `adapters/`, not inside assertions.
- Keep shared checks in `assertions/`, not copied into every scenario.
- Keep reusable data in `fixtures/`, not spread across files.
- Keep roles explicit through `actors/` so multi-user scenarios stay readable.

## When to change each area

- Change `config.ts` when routes, selectors, feature flags, or expected behavior change.
- Change `fixtures/` when test users or shared input datasets change.
- Change `adapters/` when the UI or domain interaction model changes.
- Change `assertions/` when the expected product guarantees change.
- Change `scenarios/` when coverage changes or a business flow needs to be added, split, or refined.

## Current scenario families

The current first wave covers:

- authentication
- signup validation
- session lifecycle
- first workspace creation
- document CRUD
- block editor basics
- autosave
- private document access
- shared document permissions
- smoke coverage

This directory is intentionally project-specific, but the structure is meant to stay reusable enough for any app that fits the same product model.

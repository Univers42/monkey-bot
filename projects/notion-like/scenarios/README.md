# scenarios

This directory contains the executable scenarios for the `notion-like` suite.

- Each file represents one concrete, isolatable flow: login, session lifecycle, document CRUD, permissions, or smoke coverage.
- A scenario coordinates actors, phases, adapters, and assertions, but should not hide global data or generic utilities.
- Shared scenario utilities belong in `helpers.ts`; the common registry lives in `index.ts`.

The aggregation point is [index.ts](/home/settes/cursus/trascendence/monkey-bot/projects/notion-like/scenarios/index.ts).

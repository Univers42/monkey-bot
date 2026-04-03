# fixtures

This directory contains reusable input data for the suites.

- Test users, invalid payloads, and any stable dataset used as scenario seed data belong here.
- Fixtures should stay declarative: data first, minimal logic.
- If a value changes by environment, it should come from `env` or configuration rather than being hardcoded into a scenario.

The current fixtures live in [users.ts](/home/settes/cursus/trascendence/monkey-bot/projects/notion-like/fixtures/users.ts) and [signup-invalid.ts](/home/settes/cursus/trascendence/monkey-bot/projects/notion-like/fixtures/signup-invalid.ts).

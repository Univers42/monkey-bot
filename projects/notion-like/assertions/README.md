# assertions

This directory groups reusable business and UI-state checks.

- Each file contains assertions focused on one capability: auth, documents, permissions, or workspace.
- Scenarios use them to keep intent readable and avoid repeating complex `ctx.expect(...)` calls.
- Setup, navigation, and data manipulation should not live here.

Shared re-exports are defined in [index.ts](/home/settes/cursus/trascendence/monkey-bot/projects/notion-like/assertions/index.ts).

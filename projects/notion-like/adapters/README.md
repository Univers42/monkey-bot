# adapters

This directory translates the `notion-like` domain into reusable operations against the real app.

- Each adapter encapsulates one product area: authentication, workspace, documents, sharing, or save state.
- Its job is to hide selectors, routes, and repeated actions behind a small stable API.
- Scenarios should consume adapters instead of using raw Playwright directly, except for narrow edge cases.

The main composition point is [index.ts](/home/settes/cursus/trascendence/monkey-bot/projects/notion-like/adapters/index.ts).

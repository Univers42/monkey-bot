import type { NotionLikeUser } from "../types.ts";

function envString(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function createUser(
  key: string,
  prefix: string,
  fallback: Partial<NotionLikeUser>
): NotionLikeUser {
  return {
    key,
    email: envString(`${prefix}_EMAIL`, fallback.email ?? `${key}@example.test`),
    password: envString(`${prefix}_PASSWORD`, fallback.password ?? "changeme"),
    name: envString(`${prefix}_NAME`, fallback.name ?? key)
  };
}

export function createUsers(): Record<string, NotionLikeUser> {
  return {
    owner: createUser("owner", "QA_NOTION_OWNER", {
      email: "owner@example.test",
      password: "owner-pass",
      name: "Owner"
    }),
    collaborator: createUser("collaborator", "QA_NOTION_COLLABORATOR", {
      email: "collab@example.test",
      password: "collab-pass",
      name: "Collaborator"
    }),
    fresh: createUser("fresh", "QA_NOTION_FRESH", {
      email: "fresh@example.test",
      password: "fresh-pass",
      name: "Fresh User"
    })
  };
}

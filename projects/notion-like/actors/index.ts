import type { ActorDefinition } from "../../../core.ts";

export const ownerActor: ActorDefinition = {
  id: "owner-a",
  role: "owner",
  userKey: "owner"
};

export const collaboratorActor: ActorDefinition = {
  id: "shared-user-b",
  role: "collaborator",
  userKey: "collaborator"
};

export const freshActor: ActorDefinition = {
  id: "new-user-owner",
  role: "new-user-owner",
  userKey: "fresh"
};

export const anonymousActor: ActorDefinition = {
  id: "anonymous-user",
  role: "anonymous"
};

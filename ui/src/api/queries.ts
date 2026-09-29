// User registry queries and mutations. Reads need no selected user.
import { projectListResponseSchema, projectSchema, githubTokensResponseSchema, identitiesResponseSchema, memberIdentitySchema, sourceViewSchema, type ProjectRegistrationInput, type ProjectUpdateInput, type IdentityInput, setupStatusSchema, userSchema } from "@moonbeam/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { invalidateSelection, readSelectedUserId } from "../lib/selection";
import { ApiRequestError, request } from "./client";

export const keys = {
  projects: ["projects"] as const,
  identities: ["identities"] as const,
  setup: ["setup"] as const,
  users: ["users"] as const,
  allUsers: ["users", "all"] as const,
};

export const useSetupStatus = () => useQuery({ queryKey: keys.setup, queryFn: () => request("GET", "/setup", setupStatusSchema) });

export const useUsers = () =>
  useQuery({
    queryKey: keys.users,
    queryFn: () => request("GET", "/users", z.object({ users: z.array(userSchema) })).then((r) => r.users),
    refetchInterval: 60_000,
  });

export const useAllUsers = () =>
  useQuery({
    queryKey: keys.allUsers,
    queryFn: () => request("GET", "/users?includeInactive=true", z.object({ users: z.array(userSchema) })).then((r) => r.users),
    refetchInterval: 60_000,
  });

export function useFirstRunSetup() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiRequestError, unknown>({
    mutationFn: (body) => request("POST", "/setup", z.object({ users: z.array(userSchema) }), body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.setup });
      void qc.invalidateQueries({ queryKey: keys.users });
      void qc.invalidateQueries({ queryKey: keys.identities });
    },
  });
}

// ---- user registry (CONTRACT-002 "User registry") -------------------------
// Every change needs a selected user, who is recorded as the actor. After a
// change both user lists refresh, so a deactivated selection is noticed at once
// and the header asks the person to choose again.

export type UserChange =
  | { kind: "add"; body: { displayName: string; email: string } }
  | { kind: "edit"; id: string; body: { displayName?: string; email?: string } }
  | { kind: "deactivate"; id: string }
  | { kind: "reactivate"; id: string };

export function useUserChange() {
  const qc = useQueryClient();
  return useMutation<z.infer<typeof userSchema>, ApiRequestError, UserChange>({
    mutationFn: (c) => {
      switch (c.kind) {
        case "add":
          return request("POST", "/users", userSchema, c.body);
        case "edit":
          return request("PATCH", `/users/${c.id}`, userSchema, c.body);
        case "deactivate":
        case "reactivate":
          return request("POST", `/users/${c.id}/${c.kind}`, userSchema, {});
      }
    },
    onSuccess: (u) => {
      if (!u.active && readSelectedUserId() === u.id) invalidateSelection();
      void qc.invalidateQueries({ queryKey: keys.users });
      void qc.invalidateQueries({ queryKey: keys.identities });
    },
    onError: () => {
      // A refusal may mean the list is stale (another browser changed it).
      void qc.invalidateQueries({ queryKey: keys.users });
      void qc.invalidateQueries({ queryKey: keys.identities });
    },
  });
}

// Registration and identity reads are available to viewers; writes use the common actor transport.
export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: () => request("GET", "/projects", projectListResponseSchema), refetchInterval: 60_000 });
export const useGitHubTokens = () => useQuery({ queryKey: ["github-tokens"], queryFn: () => request("GET", "/github/tokens", githubTokensResponseSchema) });
export const useIdentities = () => useQuery({ queryKey: keys.identities, queryFn: () => request("GET", "/identities", identitiesResponseSchema), refetchInterval: 60_000 });
// Read only the source metadata needed for F4 from the existing viewer endpoint.
export const useRegistrationSource = (id: string) => useQuery({ queryKey: ["registration-source", id], queryFn: () => request("GET", `/projects/${id}/view`, z.object({ source: sourceViewSchema.nullable() })), refetchInterval: 60_000 });

type ProjectChange =
  | { kind: "register"; body: ProjectRegistrationInput }
  | { kind: "edit"; id: string; body: ProjectUpdateInput }
  | { kind: "lead"; id: string; userId: string | null }
  | { kind: "remove"; id: string };
export function useProjectChange() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiRequestError, ProjectChange>({
    mutationFn: (c) => {
      switch (c.kind) {
        case "register": return request("POST", "/projects", projectSchema, c.body);
        case "edit": return request("PATCH", `/projects/${c.id}`, projectSchema, c.body);
        case "lead": return request("PUT", `/projects/${c.id}/lead-developer`, projectSchema, { userId: c.userId });
        case "remove": return request("DELETE", `/projects/${c.id}`, z.undefined());
      }
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: keys.projects }); void qc.invalidateQueries({ queryKey: ["registration-source"] }); },
  });
}
export function useIdentityChange() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiRequestError, { kind: "add"; userId: string; body: IdentityInput } | { kind: "remove"; id: string }>({
    mutationFn: (c) => c.kind === "add" ? request("POST", `/users/${c.userId}/identities`, memberIdentitySchema, c.body) : request("DELETE", `/identities/${c.id}`, z.undefined()),
    onSettled: () => { void qc.invalidateQueries({ queryKey: keys.identities }); },
  });
}

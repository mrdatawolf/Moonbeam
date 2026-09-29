// User registry queries and mutations. Reads need no selected user.
import { dashboardResponseSchema, projectListResponseSchema, projectSchema, githubTokensResponseSchema, identitiesResponseSchema, memberIdentitySchema, sourceViewSchema, type ProjectRegistrationInput, type ProjectUpdateInput, type IdentityInput, setupStatusSchema, userSchema } from "@moonbeam/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { invalidateSelection, readSelectedUserId } from "../lib/selection";
import { ApiRequestError, request } from "./client";

export const keys = {
  projects: ["projects"] as const,
  dashboard: ["dashboard"] as const,
  identities: ["identities"] as const,
  setup: ["setup"] as const,
  users: ["users"] as const,
  allUsers: ["users", "all"] as const,
};

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: () => request("GET", "/dashboard", dashboardResponseSchema), refetchInterval: 60_000 });

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
      void qc.invalidateQueries({ queryKey: keys.dashboard });
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
      void qc.invalidateQueries({ queryKey: keys.dashboard });
    },
    onError: () => {
      // A refusal may mean the list is stale (another browser changed it).
      void qc.invalidateQueries({ queryKey: keys.users });
      void qc.invalidateQueries({ queryKey: keys.identities });
      void qc.invalidateQueries({ queryKey: keys.dashboard });
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
    onSettled: () => { void qc.invalidateQueries({ queryKey: keys.dashboard }); void qc.invalidateQueries({ queryKey: keys.projects }); void qc.invalidateQueries({ queryKey: ["registration-source"] }); },
  });
}
export function useIdentityChange() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiRequestError, { kind: "add"; userId: string; body: IdentityInput } | { kind: "remove"; id: string }>({
    mutationFn: (c) => c.kind === "add" ? request("POST", `/users/${c.userId}/identities`, memberIdentitySchema, c.body) : request("DELETE", `/identities/${c.id}`, z.undefined()),
    onSettled: () => { void qc.invalidateQueries({ queryKey: keys.identities });
      void qc.invalidateQueries({ queryKey: keys.dashboard }); },
  });
}

// All project snapshot reads share an invalidation prefix after refresh or notes.
import { projectViewResponseSchema, projectTasksResponseSchema, projectTaskResponseSchema, projectDocumentsResponseSchema, projectFileResponseSchema, flagDetailSchema, flagSchema } from "@moonbeam/shared";
const projectKey = (id: string) => ["project-read", id] as const;
export const useProjectView = (id: string) => useQuery({ queryKey: [...projectKey(id), "view"], queryFn: () => request("GET", `/projects/${id}/view`, projectViewResponseSchema), refetchInterval: 60_000 });
export const useProjectTasks = (id: string) => useQuery({ queryKey: [...projectKey(id), "tasks"], queryFn: () => request("GET", `/projects/${id}/tasks`, projectTasksResponseSchema), refetchInterval: 60_000 });
export const useProjectTask = (id: string, task: string) => useQuery({ queryKey: [...projectKey(id), "task", task], queryFn: () => request("GET", `/projects/${id}/tasks/${encodeURIComponent(task)}`, projectTaskResponseSchema), refetchInterval: 60_000 });
export const useProjectDocuments = (id: string) => useQuery({ queryKey: [...projectKey(id), "documents"], queryFn: () => request("GET", `/projects/${id}/documents`, projectDocumentsResponseSchema), refetchInterval: 60_000 });
export const useProjectFile = (id: string, path: string, head: string | null) => useQuery({ queryKey: [...projectKey(id), "file", path, head], queryFn: () => request("GET", `/projects/${id}/file?path=${encodeURIComponent(path)}`, projectFileResponseSchema) });
export const useFlagDetail = (project: string, flag: string) => useQuery({ queryKey: [...projectKey(project), "flag", flag], queryFn: () => request("GET", `/flags/${flag}`, flagDetailSchema) });
export function useProjectRefresh(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => request("POST", `/projects/${id}/refresh`, sourceViewSchema, {}), onSettled: async () => { await qc.invalidateQueries({ queryKey: keys.dashboard }); await qc.invalidateQueries({ queryKey: projectKey(id) }); await qc.invalidateQueries({ queryKey: ["registration-source", id] }); } });
}
export function useFlagNote(project: string, flag: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ action, note }: { action: "dismiss" | "reopen"; note: string }) => request("POST", `/flags/${flag}/${action}`, flagSchema, { note }), onSettled: async () => { await qc.invalidateQueries({ queryKey: keys.dashboard }); await qc.invalidateQueries({ queryKey: projectKey(project) }); } });
}

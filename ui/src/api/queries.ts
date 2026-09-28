// TanStack Query hooks for the TASK-006 API. Reads need no selected user.
// Every action goes through `useTaskAction`, which writes the returned task
// into the cache and refreshes the lists it may have changed.
import {
  actionResultSchema,
  decisionQueueSchema,
  projectListResponseSchema,
  projectQueueResponseSchema,
  projectSchema,
  projectsRootResponseSchema,
  setupStatusSchema,
  taskDetailSchema,
  taskListResponseSchema,
  userSchema,
  type ActionResult,
} from "@moonbeam/shared";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { invalidateSelection, readSelectedUserId, useSelectedUserId } from "../lib/selection";
import { ApiRequestError, request } from "./client";

const LIVE = 10_000;

export const keys = {
  setup: ["setup"] as const,
  users: ["users"] as const,
  /** Active and inactive users, for user management. Invalidating `users` refreshes both. */
  allUsers: ["users", "all"] as const,
  projects: ["projects"] as const,
  projectsRoot: ["projects-root"] as const,
  project: (id: string) => ["project", id] as const,
  tasks: (projectId: string) => ["tasks", projectId] as const,
  task: (id: string) => ["task", id] as const,
  decisionQueue: ["decision-queue"] as const,
  recentAudit: ["recent-audit"] as const,
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

export const useProjects = () =>
  useQuery({
    queryKey: keys.projects,
    queryFn: () => request("GET", "/projects", projectListResponseSchema).then((r) => r.projects),
  });

export const useProjectsRoot = () =>
  useQuery({
    queryKey: keys.projectsRoot,
    queryFn: () => request("GET", "/settings/projects-root", projectsRootResponseSchema).then((r) => r.projectsRoot),
  });

export const useProject = (id: string) =>
  useQuery({ queryKey: [...keys.project(id), useSelectedUserId()], queryFn: () => request("GET", `/projects/${id}`, projectQueueResponseSchema), refetchInterval: LIVE });

export const useProjectTasks = (projectId: string) =>
  useQuery({
    queryKey: [...keys.tasks(projectId), useSelectedUserId()],
    queryFn: () => request("GET", `/projects/${projectId}/tasks`, taskListResponseSchema).then((r) => r.tasks),
    refetchInterval: LIVE,
  });

export const useTask = (id: string) =>
  useQuery({ queryKey: [...keys.task(id), useSelectedUserId()], queryFn: () => request("GET", `/tasks/${id}`, taskDetailSchema), refetchInterval: LIVE, retry: (n, e) => !(e instanceof ApiRequestError && e.category === "not_found") && n < 3 });

export const useDecisionQueue = () =>
  useQuery({ queryKey: [...keys.decisionQueue, useSelectedUserId()], queryFn: () => request("GET", "/decision-queue", decisionQueueSchema), refetchInterval: LIVE });

/** Refresh everything a lifecycle action may have changed. */
export function refreshLifecycle(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: ["task"] });
  void qc.invalidateQueries({ queryKey: ["tasks"] });
  void qc.invalidateQueries({ queryKey: ["project"] });
  void qc.invalidateQueries({ queryKey: keys.decisionQueue });
  void qc.invalidateQueries({ queryKey: keys.recentAudit });
}

/**
 * Handle rejections every action shares: `unidentified` means the selected
 * user can no longer act; the client cleared the selection and the header asks
 * the person to choose again (CONTRACT-002); `conflict` refreshes the view to the
 * current state (CONTRACT-003 A).
 */
export function onActionError(qc: QueryClient, error: unknown) {
  if (error instanceof ApiRequestError) {
    // The client has already cleared the selection and flagged it (see client.ts).
    if (error.category === "unidentified") void qc.invalidateQueries({ queryKey: keys.users });
    if (error.category === "conflict" || error.category === "invalid_transition" || error.category === "blocked") refreshLifecycle(qc);
  }
}

export type TaskActionPath =
  | "edit"
  | "approve"
  | "claim"
  | "release"
  | "handoff"
  | "accept"
  | "return"
  | "cancel"
  | "blockers"
  | "move"
  | `blockers/${string}/resolve`;

export function useTaskAction(taskId: string, path: TaskActionPath) {
  const qc = useQueryClient();
  const selectedId = useSelectedUserId();
  return useMutation<ActionResult, ApiRequestError, unknown>({
    mutationFn: (body) => request(path === "edit" ? "PATCH" : "POST", path === "edit" ? `/tasks/${taskId}` : `/tasks/${taskId}/${path}`, actionResultSchema, body ?? {}),
    onSuccess: (result) => {
      qc.setQueryData([...keys.task(result.task.id), selectedId], result.task);
      refreshLifecycle(qc);
    },
    onError: (e) => onActionError(qc, e),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  const selectedId = useSelectedUserId();
  return useMutation<ActionResult, ApiRequestError, unknown>({
    mutationFn: (body) => request("POST", `/projects/${projectId}/tasks`, actionResultSchema, body),
    onSuccess: (result) => {
      qc.setQueryData([...keys.task(result.task.id), selectedId], result.task);
      refreshLifecycle(qc);
    },
    onError: (e) => onActionError(qc, e),
  });
}

export function useFirstRunSetup() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiRequestError, unknown>({
    mutationFn: (body) => request("POST", "/setup", z.object({ users: z.array(userSchema) }), body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.setup });
      void qc.invalidateQueries({ queryKey: keys.users });
      void qc.invalidateQueries({ queryKey: keys.projectsRoot });
    },
  });
}

export function useSetProjectsRoot() {
  const qc = useQueryClient();
  return useMutation<unknown, ApiRequestError, { path: string }>({
    mutationFn: (body) => request("PUT", "/settings/projects-root", projectsRootResponseSchema, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.projectsRoot });
      void qc.invalidateQueries({ queryKey: keys.setup });
    },
    onError: (e) => onActionError(qc, e),
  });
}

export function useRegisterProject() {
  const qc = useQueryClient();
  return useMutation<z.infer<typeof projectSchema>, ApiRequestError, { path: string; name?: string; mainBranch?: string }>({
    mutationFn: (body) => request("POST", "/projects", projectSchema, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.projects }),
    onError: (e) => onActionError(qc, e),
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
      // Past records show a user's current name (CONTRACT-002 ID7).
      refreshLifecycle(qc);
    },
    onError: (e) => {
      onActionError(qc, e);
      // A refusal may mean the list is stale (another browser changed it).
      void qc.invalidateQueries({ queryKey: keys.users });
    },
  });
}

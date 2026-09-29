// User registry queries and mutations. Reads need no selected user.
import { setupStatusSchema, userSchema } from "@moonbeam/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { invalidateSelection, readSelectedUserId } from "../lib/selection";
import { ApiRequestError, request } from "./client";

export const keys = {
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
    },
    onError: () => {
      // A refusal may mean the list is stale (another browser changed it).
      void qc.invalidateQueries({ queryKey: keys.users });
    },
  });
}

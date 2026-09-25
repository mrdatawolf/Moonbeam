// Connection state to the Moonbeam server, set by every request. While lost,
// the UI shows "Connection lost. Retrying." and disables actions with that
// reason (CONTRACT-003 "Failure behavior").
import { useSyncExternalStore } from "react";

type State = "ok" | "lost";

let state: State = "ok";
const listeners = new Set<() => void>();

export const connection = {
  get: () => state,
  set(next: State) {
    if (next === state) return;
    state = next;
    for (const l of listeners) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useConnectionLost(): boolean {
  return useSyncExternalStore(connection.subscribe, () => connection.get() === "lost");
}

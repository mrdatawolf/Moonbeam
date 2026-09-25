// The user selected in this browser (CONTRACT-002 "Human user selection").
// It belongs to the browser, persists across reloads and restarts, and changes
// only when the person changes or clears it. Tabs of the same browser follow
// each other through the `storage` event.
import { useSyncExternalStore } from "react";

export const SELECTION_KEY = "moonbeam.selectedUserId";

const listeners = new Set<() => void>();

export function readSelectedUserId(): string | null {
  try {
    return globalThis.localStorage?.getItem(SELECTION_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeSelectedUserId(id: string | null): void {
  try {
    if (id) localStorage.setItem(SELECTION_KEY, id);
    else localStorage.removeItem(SELECTION_KEY);
  } catch {
    // Storage unavailable (private mode): the selection lasts for this page only.
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SELECTION_KEY) l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSelectedUserId(): string | null {
  return useSyncExternalStore(subscribe, readSelectedUserId, () => null);
}

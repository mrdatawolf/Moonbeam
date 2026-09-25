// The acting user (CONTRACT-002): the selection stored in this browser,
// resolved against the active users. A stored selection that is no longer an
// active user is reported as invalid; the UI asks the person to choose again
// and never switches to someone else silently.
import type { User } from "@moonbeam/shared";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useUsers } from "../api/queries";
import { chooseSelectedUserId, invalidateSelection, readSelectedUserId, useSelectedUserId, useSelectionInvalidated } from "./selection";

interface CurrentUser {
  /** The selected, active user; null when none is selected or the selection is invalid. */
  user: User | null;
  /** Something was selected in this browser but is not an active user any more. */
  selectionInvalid: boolean;
  select: (id: string | null) => void;
}

const Ctx = createContext<CurrentUser>({ user: null, selectionInvalid: false, select: () => {} });

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const selectedId = useSelectedUserId();
  const invalidated = useSelectionInvalidated();
  const users = useUsers();
  useEffect(() => {
    if (selectedId && users.isSuccess && !users.data.some((u) => u.id === selectedId && u.active) && readSelectedUserId() === selectedId) {
      invalidateSelection();
    }
  }, [selectedId, users.isSuccess, users.data]);
  const value = useMemo<CurrentUser>(() => {
    const user = users.data?.find((u) => u.id === selectedId && u.active) ?? null;
    return {
      user,
      selectionInvalid: invalidated || (selectedId !== null && users.isSuccess && user === null),
      select: chooseSelectedUserId,
    };
  }, [selectedId, invalidated, users.data, users.isSuccess]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCurrentUser = () => useContext(Ctx);

/** Id of the user picker, so "Choose who you are" links can move focus to it. */
export const USER_PICKER_ID = "user-picker";

export function focusUserPicker() {
  document.getElementById(USER_PICKER_ID)?.focus();
}

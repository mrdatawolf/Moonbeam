import { userSchema } from "@moonbeam/shared";
import { describe, expect, it, vi } from "vitest";
import { chooseSelectedUserId, readSelectedUserId, readSelectionInvalidated } from "../lib/selection";
import { otherUser, user } from "../test/fixtures";
import { request } from "./client";

const refused = () => new Response(JSON.stringify({ error: { category: "unidentified", message: "Choose an active user." } }), { status: 401 });

describe("invalid user selection", () => {
  it("clears a refused selection and retries a read as a viewer", async () => {
    chooseSelectedUserId(user.id);
    const fetch = vi.fn().mockResolvedValueOnce(refused()).mockResolvedValueOnce(new Response(JSON.stringify(user)));
    vi.stubGlobal("fetch", fetch);
    await expect(request("GET", "/users", userSchema)).resolves.toEqual(user);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[1].headers).not.toHaveProperty("x-moonbeam-user");
    expect(readSelectedUserId()).toBeNull();
    expect(readSelectionInvalidated()).toBe(true);
  });

  it("never retries a refused mutation", async () => {
    chooseSelectedUserId(user.id);
    const fetch = vi.fn().mockResolvedValue(refused());
    vi.stubGlobal("fetch", fetch);
    await expect(request("POST", "/users", userSchema, {})).rejects.toMatchObject({ category: "unidentified" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readSelectedUserId()).toBeNull();
    expect(readSelectionInvalidated()).toBe(true);
  });

  it("does not clear a newer choice when an old request is refused", async () => {
    chooseSelectedUserId(user.id);
    let respond!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })));
    const pending = request("POST", "/users", userSchema, {});
    chooseSelectedUserId(otherUser.id);
    respond(refused());
    await expect(pending).rejects.toMatchObject({ category: "unidentified" });
    expect(readSelectedUserId()).toBe(otherUser.id);
    expect(readSelectionInvalidated()).toBe(false);
  });
});

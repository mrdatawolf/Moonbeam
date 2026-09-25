// ADR-006 / CONTRACT-004 B13 (minimal): projects root and registration.
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, expectOk, expectRejected, gitInit, type Harness } from "./harness.js";

let h: Harness;
afterEach(async () => h?.close());

async function setupUser() {
  const res = await h.req("POST", "/setup", { body: { users: [{ displayName: "Pat", email: "pat@example.com" }] } });
  return { user: res.body.users[0].id as string };
}

describe("Projects root", () => {
  it("refuses the data directory, the install directory, anything inside them (also via a symlink), and non-directories", async () => {
    h = await createHarness();
    const as = await setupUser();
    const scratch = join(h.dirs.root, "..");
    const cases = [
      h.dirs.home,
      join(h.dirs.home, "db"),
      join(scratch, "install"),
      "relative/path",
      join(scratch, "does-not-exist"),
    ];
    mkdirSync(join(h.dirs.home, "db"));
    symlinkSync(join(h.dirs.home, "db"), join(scratch, "sneaky"));
    cases.push(join(scratch, "sneaky"));
    for (const path of cases) expectRejected(await h.req("PUT", "/settings/projects-root", { as, body: { path } }), "validation", 422);
    const ok = await h.req("PUT", "/settings/projects-root", { as, body: { path: h.dirs.root } });
    expectOk(ok);
    expect((await h.req("GET", "/settings/projects-root")).body.projectsRoot).toBe(ok.body.projectsRoot);
  });

  it("may be chosen during first-run setup", async () => {
    h = await createHarness();
    const res = await h.req("POST", "/setup", { body: { users: [{ displayName: "Pat", email: "pat@example.com" }], projectsRoot: h.dirs.root } });
    expectOk(res, 201);
    expect((await h.req("GET", "/setup")).body.projectsRoot).toMatch(/projects$/);
  });

  it("refuses a new root that registered projects would fall outside (CONTRACT-004 Q25 decision a)", async () => {
    h = await createHarness();
    const as = await setupUser();
    const inner = join(h.dirs.root, "team");
    mkdirSync(inner);
    expectOk(await h.req("PUT", "/settings/projects-root", { as, body: { path: h.dirs.root } }));
    expectOk(await h.req("POST", "/projects", { as, body: { path: gitInit(join(h.dirs.root, "solo")) } }), 201);
    expectRejected(await h.req("PUT", "/settings/projects-root", { as, body: { path: inner } }), "validation", 422);
  });
});

describe("Project registration", () => {
  it("registers existing git repositories under the root, including nested ones and several projects", async () => {
    h = await createHarness();
    const as = await setupUser();
    expectRejected(await h.req("POST", "/projects", { as, body: { path: gitInit(join(h.dirs.root, "early")) } }), "validation", 422);
    expectOk(await h.req("PUT", "/settings/projects-root", { as, body: { path: h.dirs.root } }));
    const a = await h.req("POST", "/projects", { as, body: { path: join(h.dirs.root, "early") } });
    expectOk(a, 201);
    expect(a.body).toMatchObject({ name: "early", mainBranch: "main" });
    const nested = gitInit(join(h.dirs.root, "clients", "acme", "site"));
    const b = await h.req("POST", "/projects", { as, body: { path: nested, name: "Acme site", mainBranch: "trunk" } });
    expectOk(b, 201);
    expect(b.body).toMatchObject({ name: "Acme site", mainBranch: "trunk" });
    expect((await h.req("GET", "/projects")).body.projects).toHaveLength(2);
    const audit = await h.req("GET", "/decision-queue");
    expect(audit.status).toBe(200);
  });

  it("rejects paths outside the root (also via a symlink), non-repositories, repository subfolders and duplicates", async () => {
    h = await createHarness();
    const as = await setupUser();
    expectOk(await h.req("PUT", "/settings/projects-root", { as, body: { path: h.dirs.root } }));
    const outside = gitInit(join(h.dirs.root, "..", "outside"));
    symlinkSync(outside, join(h.dirs.root, "link-out"));
    const plain = join(h.dirs.root, "plain");
    mkdirSync(plain);
    const repo = gitInit(join(h.dirs.root, "repo"));
    mkdirSync(join(repo, "sub"));
    expectOk(await h.req("POST", "/projects", { as, body: { path: repo } }), 201);
    for (const path of [outside, join(h.dirs.root, "link-out"), plain, join(repo, "sub"), repo, h.dirs.root]) {
      expectRejected(await h.req("POST", "/projects", { as, body: { path } }), "validation", 422);
    }
  });
});

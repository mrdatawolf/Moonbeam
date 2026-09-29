import { describe, expect, it } from "vitest";
import { buildMatcher, findConflicts, type MemberIdentities } from "./index.js";

const patrick: MemberIdentities = {
  userId: "p", displayName: "Patrick", active: true,
  emails: [" Patrick@Example.com "], logins: ["Pat-Git"], aliases: ["Pat"],
};
const sam: MemberIdentities = {
  userId: "s", displayName: "Sam", active: true,
  emails: ["sam@example.com"], logins: ["sam-git"], aliases: ["Samuel"],
};
const author = { name: "Some Author", email: "unknown@example.com" };
const member = { kind: "member", userId: "p", inactive: false };

describe("identity matching", () => {
  it("I3 V6: case-insensitive login wins over another member's e-mail", () => {
    expect(buildMatcher([patrick, sam]).matchAuthor({ ...author, login: "PAT-GIT", email: "sam@example.com" })).toEqual(member);
  });
  it("I1 I3 V6: caller-supplied registry e-mail matches after trimming and case folding", () => {
    const matcher = buildMatcher([patrick]);
    expect(matcher.matchAuthor({ ...author, email: "  PATRICK@example.COM\t" })).toEqual(member);
    expect(matcher.matchAuthor({ ...author, login: "unknown", email: "patrick@example.com" })).toEqual(member);
    expect(matcher.matchAuthor({ ...author, login: null, email: "patrick@example.com" })).toEqual(member);
  });
  it.each(["Pat-Git@users.noreply.github.com", "123+PAT-GIT@USERS.NOREPLY.GITHUB.COM"])(
    "I3 V6: no-reply form %s resolves to its login", (email) => {
      expect(buildMatcher([patrick]).matchAuthor({ ...author, email: ` ${email} ` })).toEqual(member);
    },
  );
  it("I3: explicit e-mail wins over the no-reply login", () => {
    const email = "123+pat-git@users.noreply.github.com";
    expect(buildMatcher([patrick, { ...sam, emails: [email] }]).matchAuthor({ ...author, email })).toEqual({ kind: "member", userId: "s", inactive: false });
  });
  it.each([
    "abc+pat-git@users.noreply.github.com", "+pat-git@users.noreply.github.com",
    "123+pat-git@users.noreply.github.com.evil", "pat-git@github.com",
    "123+456+pat-git@users.noreply.github.com", "@users.noreply.github.com",
    "pat git@users.noreply.github.com",
  ])("I3: rejects malformed no-reply address %s", (email) => {
    const recorded = { ...author, email };
    expect(buildMatcher([patrick]).matchAuthor(recorded)).toEqual({ kind: "unmatched", recorded });
  });
  it("I3 I7: display names and aliases never match commit authors", () => {
    for (const name of ["Patrick", "Pat"]) {
      const recorded = { name, email: " Unknown@Example.com ", login: "Unknown" };
      expect(buildMatcher([patrick]).matchAuthor(recorded)).toEqual({ kind: "unmatched", recorded });
    }
  });
  it("I3: logins are case-insensitive without extra whitespace normalization", () => {
    const recorded = { ...author, login: " pat-git " };
    expect(buildMatcher([patrick]).matchAuthor(recorded)).toEqual({ kind: "unmatched", recorded });
  });
  it("I4 V6: ambiguous login stops before a unique e-mail", () => {
    const recorded = { ...author, login: "PAT-GIT", email: "patrick@example.com" };
    const result = buildMatcher([patrick, { ...sam, logins: ["pat-git"] }]).matchAuthor(recorded);
    expect(result).toEqual({ kind: "ambiguous", recorded, members: [
      { userId: "p", displayName: "Patrick", inactive: false },
      { userId: "s", displayName: "Sam", inactive: false },
    ] });
  });
  it("I4: ambiguous e-mail stops before a unique no-reply login", () => {
    const email = "pat-git@users.noreply.github.com";
    const recorded = { ...author, email };
    expect(buildMatcher([{ ...patrick, emails: [email] }, { ...sam, emails: [email] }]).matchAuthor(recorded)).toMatchObject({ kind: "ambiguous", recorded });
  });
  it("I4: no-reply login ambiguity is unmatched too", () => {
    expect(buildMatcher([patrick, { ...sam, logins: ["PAT-GIT"] }]).matchAuthor({ ...author, email: "42+pat-git@users.noreply.github.com" }).kind).toBe("ambiguous");
  });
  it("I5: display names and aliases match case-insensitively with trimming", () => {
    const matcher = buildMatcher([patrick]);
    for (const name of ["patrick", " PATRICK ", " pat "]) expect(matcher.matchRecordedName(name)).toEqual(member);
    expect(matcher.matchRecordedName("Patrick (a note)").kind).toBe("unmatched");
    expect(buildMatcher([{ ...sam, aliases: [" Patrick "] }]).matchRecordedName("patrick")).toMatchObject({ kind: "member", userId: "s" });
  });
  it("I4 I5 I7: display name/alias ambiguity preserves the recorded name", () => {
    expect(buildMatcher([patrick, { ...sam, aliases: ["patrick"] }]).matchRecordedName(" PATRICK ")).toMatchObject({ kind: "ambiguous", recorded: " PATRICK " });
    expect(buildMatcher([patrick]).matchRecordedName(" Unknown ")).toEqual({ kind: "unmatched", recorded: " Unknown " });
  });
  it("I6 V6: inactive members still match authors and recorded names", () => {
    const matcher = buildMatcher([{ ...patrick, active: false }]);
    expect(matcher.matchAuthor({ ...author, login: "pat-git" })).toEqual({ ...member, inactive: true });
    expect(matcher.matchRecordedName("Patrick")).toEqual({ ...member, inactive: true });
  });
  it("I6 V6: adding an e-mail and rebuilding re-attributes an author", () => {
    const emails: string[] = [];
    const members = [{ ...patrick, emails }];
    const before = buildMatcher(members);
    expect(before.matchAuthor(author)).toEqual({ kind: "unmatched", recorded: author });
    emails.push(author.email);
    expect(buildMatcher(members).matchAuthor(author)).toEqual(member);
    expect(before.matchAuthor(author).kind).toBe("unmatched");
  });
  it("I4: finds every normalized conflict and names all owners, including inactive ones", () => {
    const members = [patrick, { ...sam, active: false, logins: ["PAT-GIT"], emails: ["patrick@example.com"], aliases: [" PATRICK ", "PAT"] }];
    const owners = [{ userId: "p", displayName: "Patrick", inactive: false }, { userId: "s", displayName: "Sam", inactive: true }];
    expect(findConflicts(members)).toEqual([
      { kind: "login", value: "pat-git", members: owners },
      { kind: "email", value: "patrick@example.com", members: owners },
      { kind: "name", value: "patrick", members: owners },
      { kind: "name", value: "pat", members: owners },
    ]);
  });
  it("I4: duplicates within one member do not create ambiguity or conflicts", () => {
    const repeated = { ...patrick, emails: ["patrick@example.com", " PATRICK@example.com "], logins: ["pat-git", "PAT-GIT"], aliases: ["Patrick", " PATRICK "] };
    expect(findConflicts([repeated])).toEqual([]);
    const matcher = buildMatcher([repeated]);
    expect(matcher.matchRecordedName("patrick")).toEqual(member);
    expect(matcher.matchAuthor({ ...author, login: "pat-git" })).toEqual(member);
    expect(matcher.matchAuthor({ ...author, email: "patrick@example.com" })).toEqual(member);
  });
  it("I4: conflicts count all distinct members and keep identity categories separate", () => {
    const third = { ...sam, userId: "third", displayName: "Third" };
    expect(findConflicts([sam, third, { ...patrick, logins: ["sam-git"] }]).find((c) => c.kind === "login")?.members).toHaveLength(3);
    expect(findConflicts([patrick, { ...sam, aliases: ["pat-git", "patrick@example.com"] }])).toEqual([]);
  });
  it("I7: empty identities and an empty registry remain unmatched", () => {
    const blank = { ...patrick, displayName: " ", emails: [" "], logins: [""], aliases: [""] };
    expect(buildMatcher([blank]).matchRecordedName("").kind).toBe("unmatched");
    expect(buildMatcher([blank]).matchAuthor({ name: "", email: "", login: "" }).kind).toBe("unmatched");
    expect(buildMatcher([]).matchAuthor(author)).toEqual({ kind: "unmatched", recorded: author });
    expect(findConflicts([])).toEqual([]);
  });
  it("I6: caller edits and returned conflict details cannot mutate a matcher snapshot", () => {
    const mutable = { ...sam, logins: ["pat-git"] };
    const matcher = buildMatcher([patrick, mutable]);
    mutable.active = false;
    mutable.displayName = "Changed";
    const result = matcher.matchAuthor({ ...author, login: "pat-git" });
    if (result.kind !== "ambiguous") throw new Error("Expected ambiguity");
    result.members.splice(0);
    expect(matcher.matchAuthor({ ...author, login: "pat-git" })).toMatchObject({ kind: "ambiguous", members: [
      { displayName: "Patrick", inactive: false }, { displayName: "Sam", inactive: false },
    ] });
  });
});

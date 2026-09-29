/** CONTRACT-006 I1: callers include the registry e-mail in emails. */
export interface MemberIdentities {
  userId: string;
  displayName: string;
  active: boolean;
  emails: readonly string[];
  logins: readonly string[];
  aliases: readonly string[];
}

/** I2: the author only; the committer is never passed to the matcher. */
export interface AuthorIdentity {
  name: string;
  email: string;
  login?: string | null;
}

export interface ConflictMember {
  userId: string;
  displayName: string;
  inactive: boolean;
}

/** Only kind: member is an attribution. Ambiguous counts as unmatched (I4). */
export type IdentityMatch<T> =
  | { kind: "member"; userId: string; inactive: boolean }
  | { kind: "unmatched"; recorded: T }
  | { kind: "ambiguous"; recorded: T; members: ConflictMember[] };

export interface IdentityMatcher {
  matchAuthor(author: AuthorIdentity): IdentityMatch<AuthorIdentity>;
  /** Pass the name part already extracted by P5. */
  matchRecordedName(name: string): IdentityMatch<string>;
}

export interface IdentityConflict {
  kind: "login" | "email" | "name";
  /** Normalized identity shared by these members. */
  value: string;
  members: ConflictMember[];
}

type Index = Map<string, Map<string, ConflictMember>>;

const normalizeText = (value: string): string => value.trim().toLowerCase();
// I3 specifies case folding, but not whitespace trimming, for logins.
const normalizeLogin = (value: string): string => value.toLowerCase();

function add(index: Index, value: string, member: ConflictMember): void {
  if (value === "") return;
  let owners = index.get(value);
  if (!owners) {
    owners = new Map();
    index.set(value, owners);
  }
  // Repeated aliases/identities belonging to one user are not conflicts.
  owners.set(member.userId, member);
}

function buildIndexes(members: readonly MemberIdentities[]) {
  const login: Index = new Map();
  const email: Index = new Map();
  const name: Index = new Map();
  for (const member of members) {
    const owner = {
      userId: member.userId,
      displayName: member.displayName,
      inactive: !member.active,
    };
    for (const value of member.logins) add(login, normalizeLogin(value), owner);
    for (const value of member.emails) add(email, normalizeText(value), owner);
    for (const value of [member.displayName, ...member.aliases]) {
      add(name, normalizeText(value), owner);
    }
  }
  return { login, email, name };
}

function resolve<T>(owners: Map<string, ConflictMember> | undefined, recorded: T): IdentityMatch<T> {
  if (!owners || owners.size === 0) return { kind: "unmatched", recorded };
  const members = [...owners.values()];
  const member = members[0];
  if (members.length === 1 && member) {
    return { kind: "member", userId: member.userId, inactive: member.inactive };
  }
  return { kind: "ambiguous", recorded, members: members.map((owner) => ({ ...owner })) };
}

/** I3–I7: a pure snapshot; rebuild with current identities to re-attribute. */
export function buildMatcher(members: readonly MemberIdentities[]): IdentityMatcher {
  const indexes = buildIndexes(members);
  return {
    matchAuthor(author) {
      const recorded = { ...author };
      const login = author.login == null ? undefined : indexes.login.get(normalizeLogin(author.login));
      if (login) return resolve(login, recorded);
      const email = normalizeText(author.email);
      const owners = indexes.email.get(email);
      if (owners) return resolve(owners, recorded);
      // Both documented forms; reject extra separators, whitespace and domains.
      const noReply = /^(?:[0-9]+\+)?([a-z0-9-]+)@users\.noreply\.github\.com$/.exec(email);
      const noReplyLogin = noReply?.[1];
      return resolve(noReplyLogin === undefined ? undefined : indexes.login.get(noReplyLogin), recorded);
    },
    matchRecordedName(name) {
      return resolve(indexes.name.get(normalizeText(name)), name);
    },
  };
}

/** I4: all conflicts, including inactive members, in input encounter order. */
export function findConflicts(members: readonly MemberIdentities[]): IdentityConflict[] {
  const indexes = buildIndexes(members);
  const conflicts: IdentityConflict[] = [];
  for (const kind of ["login", "email", "name"] as const) {
    for (const [value, owners] of indexes[kind]) {
      if (owners.size > 1) {
        conflicts.push({ kind, value, members: [...owners.values()].map((owner) => ({ ...owner })) });
      }
    }
  }
  return conflicts;
}

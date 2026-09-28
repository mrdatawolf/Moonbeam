# TASK-028: Identity matching in @moonbeam/dbc

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by:
Approved date:
Related contracts: CONTRACT-006, CONTRACT-002
Related ADRs: ADR-003, ADR-008
Dependencies: TASK-027

## Desired outcome

Pure functions map commit authors and recorded names to board members (I2 to
I5, I7), and report identity conflicts (I4). Flags (TASK-030), the API
(TASK-033), and the views (TASK-036) all use them.

## Context

Identities are data in Moonbeam: e-mails, logins, and aliases per member, plus
their CONTRACT-002 e-mail. Matching runs with the current mapping every time,
which is how re-attribution works (I6).

## Scope

### Included

- `packages/dbc/src/identity/`:
  - the type `MemberIdentities { userId, displayName, active, emails, logins, aliases }`. The caller includes the CONTRACT-002 e-mail in `emails`.
  - `buildMatcher(members)`, returning:
    - `matchAuthor({ name, email, login })`, in I3 order: login (case-insensitive), then e-mail (case-insensitive, trimmed), then a GitHub no-reply address (`<login>@users.noreply.github.com` or `<digits>+<login>@users.noreply.github.com`). The result is `member` (userId, inactive flag), `unmatched`, or `ambiguous`, and `ambiguous` counts as unmatched (I4). Author names are never used.
    - `matchRecordedName(name)` (I5): the display name or an alias, case-insensitive and trimmed; ambiguous means unmatched.
  - `findConflicts(members)`: every login, e-mail, or name (display name or alias) held by two or more members, with the members named (I4).
  - tests
- Replace the `identity/index.ts` stub with the exports.

### Excluded

- Storage, API, and UI (TASK-031, TASK-033, TASK-037).
- Flags.

### Paths

- `packages/dbc/src/identity/`

## Plan

1. Normalize the identities once in `buildMatcher`.
2. Implement the three steps of I3 and the no-reply parser.
3. Implement the I5 name match and `findConflicts`.
4. Write the V6 tests.

## Acceptance criteria

- [ ] I3: a login match wins over an e-mail match for a different member. An e-mail match is case-insensitive and trimmed. Both no-reply forms resolve to their login. Names never match commits.
- [ ] I4: an identity matching two members is unmatched, and `findConflicts` names both. Assumption: the first I3 step that matches anything decides (TASK-023 question 11).
- [ ] I5: "patrick" matches the display name "Patrick" and any alias. The note part is already removed by P5.
- [ ] I6 and I7: deactivated members still match and are marked inactive. Unmatched results carry the identity as recorded.
- [ ] V6: tests cover a match by login, by e-mail, and by no-reply address; an ambiguous identity; an unmatched one; a deactivated member; and re-attribution (building a new matcher after adding an e-mail changes the result).

## Validation requirements

- `pnpm --filter @moonbeam/dbc typecheck` and `pnpm --filter @moonbeam/dbc test`.
- The full `pnpm typecheck`, `pnpm test`, `pnpm build` at handoff. Report any failures outside this task's paths.

## Risks and assumptions

- The ambiguity-order reading depends on TASK-023 question 11.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

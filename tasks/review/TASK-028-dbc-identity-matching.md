# TASK-028: Identity matching in @moonbeam/dbc

Owner role: Implementer
Assigned agent: openai-coder (Codex)
Proposed by: Jarvis (TASK-023)
Proposed date: 2026-09-28
Approved by: Patrick
Approved date: 2026-09-28
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

Implemented TASK-028 in the shared main checkout; ready for independent review.

Files changed:
- `packages/dbc/src/identity/matcher.ts`: pure matching and conflict reporting.
- `packages/dbc/src/identity/matcher.test.ts`: 26 identity tests with rule IDs.
- `packages/dbc/src/identity/index.ts`: public exports replacing the stub.
- `tasks/in-progress/TASK-028-dbc-identity-matching.md`: this handoff only.

Public API:
- `buildMatcher(members)` returns `matchAuthor({ name, email, login? })` and
  `matchRecordedName(name)`.
- Results use `kind`: `member` includes `userId` and `inactive`; `unmatched`
  includes `recorded`; `ambiguous` includes `recorded` and named `members`.
  Only `member` is an attribution; `ambiguous` counts as unmatched.
- `findConflicts(members)` returns normalized login, e-mail, and name conflicts,
  each with all owners' user IDs, display names, and inactive flags.
- Exported types: `MemberIdentities`, `AuthorIdentity`, `IdentityMatcher`,
  `IdentityMatch<T>`, `IdentityConflict`, and `ConflictMember`.

Validation:
- Initial package typecheck attempt could not start: `pnpm` was absent from
  the shell PATH (exit 127). All checks below ran with the installed
  `/home/patrick/.nvm/versions/node/v24.16.0/bin` prepended to PATH.
- `pnpm --filter @moonbeam/dbc typecheck`: passed.
- `pnpm --filter @moonbeam/dbc test`: passed, 104 tests in 9 files, including
  26 new identity tests.
- `pnpm typecheck`: passed across all five workspace packages.
- `pnpm test`: passed, 147 tests in 18 files: dbc 104, db 6, shared 4,
  server 12, UI 21. No failed or skipped tests were reported.
- `pnpm build`: passed across all five workspace packages.
- `git diff --check`: passed. No validation failures outside the task scope.

Acceptance criteria evidence:
- I3: tests verify login precedence over another member's e-mail, trimmed and
  case-insensitive e-mail matching, both no-reply forms, explicit e-mail
  precedence over no-reply parsing, and exclusion of author names and aliases.
- I4: the first matching step decides. Tests cover ambiguity at all three
  author steps, no fallthrough after ambiguity, named conflicts across every
  identity category, three owners, and deduplication within one member.
- I5: display names and aliases match after trimming and case folding,
  including `patrick` matching `Patrick`; ambiguous names remain unattributed.
- I6/I7: inactive members still match with `inactive: true`; unmatched and
  ambiguous results retain the identity as recorded. Matchers snapshot the
  mapping, and rebuilding after an e-mail addition re-attributes the author.
- V6: all requested matcher scenarios are covered. FL-8 integration remains
  with downstream flag work, as flags are excluded from this task.

Assumptions and deviations:
- No scope deviations. Callers supply the registry e-mail in `emails` and
  remove P5 notes before recorded-name matching, as assigned.
- Logins are case-folded without trimming, following I3 literally; e-mails
  and names are trimmed. Empty normalized identities are ignored.
- Member ownership is keyed by `userId`; callers provide consistent registry
  records. Conflict groups and owners retain input encounter order.
- Matching provides attribution only, not proof of who acted (I8).

Unresolved risks: none identified. No git write commands were run, no processes
were left running, and unrelated concurrent changes were left untouched. The
task remains in `in-progress/` for the dispatcher to move and commit; it has
not been marked accepted.

**Dispatcher check:**

- Changes are only under `packages/dbc/src/identity/` and in this handoff.
- Re-ran dbc tests (9 files, 104 passed), server tests (12 passed), and
  workspace typecheck.
- Codex's own run included the server database suite. This is the first run
  since `network_access = true` was set in `~/.codex/config.toml`.

## Review

Not reviewed.

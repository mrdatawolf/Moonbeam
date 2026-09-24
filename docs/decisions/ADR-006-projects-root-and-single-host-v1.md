# ADR-006: Projects live in a user-defined projects root; V1 runs on one host

Status: Proposed
Date: 2026-09-24
Decision owners: Board (direction set by Patrick, 2026-09-24)
Related tasks and contracts: CONTRACT-004, ADR-001, ADR-005

## Context

CONTRACT-004, as first written, gave Moonbeam its own central (bare) copy of
each project's repository, with GitHub as a mirror that Moonbeam pushed to after
every acceptance. The board wants the opposite. Team members already keep their
repositories in folders they organize themselves (for example, many projects
under `/home/patrick/Documents/Github` in a particular order and layout).
Accepted work should land there. Nothing should reach GitHub without a human
deciding it should.

## Decision

1. **Setup requires a projects root.** On first run, Moonbeam asks for the
   directory where projects and repositories live. Moonbeam refuses a projects
   root inside its own install directory or its data directory
   (`MOONBEAM_HOME`, default `~/.moonbeam`). Moonbeam itself may live inside the
   projects root.
2. **Moonbeam never holds project repositories.** Each project is registered
   as an existing git repository under the projects root. Registration offers
   the repositories it finds there, including nested layouts, and rejects paths
   outside the root. That repository is the canonical one.
3. **Your folders stay as you left them until acceptance.** Task branches are
   worked in git worktrees in Moonbeam's data directory, not in your folder.
   The board reviews results in Moonbeam's review screen (ADR-005).
4. **Acceptance merges into your checkout and requires a safe state.** The
   acceptance merge (ADR-005) goes into the repository's `main`. If `main` is
   checked out in the project folder, the accept is allowed only when that
   folder is on `main` with no uncommitted changes. The merge then updates the
   files there, as a pull would. Otherwise the accept is refused with a message
   saying what to fix, and nothing changes.
5. **Moonbeam never pushes on its own.** After acceptance, the human either
   pushes by hand or asks Moonbeam to push, by explicit request, in the UI.
   Moonbeam never force-pushes. If a push is rejected (for example because the
   remote has diverged), Moonbeam reports it on the project and changes
   nothing.
6. **V1 runs on a single host.** Moonbeam, its runners, and every project
   repository are on the same machine, currently the box at `192.168.203.117`.
   Local-model endpoints on other LAN machines are still called over HTTP.
   Runners and repositories on other machines are deferred to V2, together with
   true multi-user operation.

## Alternatives considered

- **A Moonbeam-held canonical repository with GitHub as a mirror.** This was
  CONTRACT-004's original model. Rejected: it duplicates repositories, hides
  work from the folders people use, and pushes without asking.
- **Offering both an internal and an external mode.** Rejected by the board:
  one model is simpler, and projects stay where people keep them.

## Consequences

### Benefits

- Accepted work appears in the folders people already use.
- Commits made by hand are simply commits in the project's repository.
  Moonbeam shows them as "main changed outside Moonbeam". This resolves
  CONTRACT-004 Q17.
- Nothing is published without a human decision.

### Costs and risks

- An accept can be refused because of the state of someone's working folder.
  The message must say exactly what to do.
- Single-host V1 limits where runners can run, until V2.
- Moving or renaming a project folder breaks its registration. Moonbeam must
  detect this and offer to relink the project.

## Follow-up work

- Update CONTRACT-004:
  - remove the Moonbeam-held canonical repository and the automatic mirror
    push
  - add the projects root, registration, the working-folder safety check at
    accept, and the explicit push action
  - resolve Q17 and Q18
- Update CONTRACT-001 T9 if the accept preconditions need the working-folder
  check. Update CONTRACT-003 for the push action and the accept-refused
  message.
- Update `docs/PROJECT.md` constraints: single host in V1, and the projects
  root.

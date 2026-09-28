# ADR-006: Projects live in a user-defined projects root; V1 runs on one host

Status: Approved; superseded by ADR-008 (2026-09-28), see the amendment at the end
Approved by: Patrick
Approved date: 2026-09-24
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
4. **Merging requires a safe state.** The merge into `main` is a separate human
   step after acceptance (ADR-005 amendment of 2026-09-24): a human asks
   Moonbeam to merge, or merges by hand. When Moonbeam merges and `main` is
   checked out in the project folder, the merge is allowed only when that
   folder is on `main` with no uncommitted changes. The merge then updates the
   files there, as a pull would. Otherwise the merge is refused with a message
   saying what to fix, and nothing changes.
5. **Moonbeam never pushes on its own.** After a merge, the human either pushes
   by hand or asks Moonbeam to push, by explicit request, in the UI.
   Moonbeam never force-pushes. If a push is rejected (for example because the
   remote has diverged), Moonbeam reports it on the project and changes
   nothing.
6. **V1 runs on a single host.** Moonbeam, its runners, and every project
   repository are on the same machine, currently the box at `192.168.203.117`.
   That host does all file and git work. The team uses Moonbeam's web interface
   from their own machines over the LAN.
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

- A merge can be refused because of the state of someone's working folder.
  The message must say exactly what to do.
- Single-host V1 limits where runners can run, until V2.
- Moving or renaming a project folder breaks its registration. Moonbeam must
  detect this and offer to relink the project.

## Follow-up work

- Update CONTRACT-004:
  - remove the Moonbeam-held canonical repository and the automatic mirror
    push
  - add the projects root, registration, the merge action with its
    working-folder safety check, and the explicit push action
  - resolve Q17 and Q18
- Update CONTRACT-001 and CONTRACT-003 for acceptance without merging, the
  merge and push actions, and the merge-refused message (ADR-005 amendment).
- Update `docs/PROJECT.md` constraints: single host in V1, and the projects
  root.

## Amendment — 2026-09-28: superseded by ADR-008

Recorded by TASK-022. The decision text above is left as approved. ADR-008
(Approved, 2026-09-28) supersedes this ADR:

- **GitHub replaces the projects root as the reference** (ADR-008 decision 5).
  Moonbeam reads each project's GitHub repository by polling with a read-only
  token. Project registration is re-pointed from local repositories under a
  projects root to GitHub repositories.
- **The single host, worktrees in `MOONBEAM_HOME`, and the merge and push
  actions no longer apply.** Lead developers work in their own clones with
  their own tools.
- **The intent that nothing is published without a human holds more strongly.**
  Moonbeam does not write to repositories or to GitHub at all (ADR-008
  decision 6).

# TASK-019: Offer the repositories found under the projects root for registration

Owner role: Implementer
Assigned agent:
Proposed by: Claude (planning session)
Proposed date: 2026-09-28
Approved by:
Approved date:
Related contracts: CONTRACT-004 (B13 registration), CONTRACT-002 (human-only actions)
Related ADRs: ADR-006 (decision 2)
Dependencies: TASK-006 and TASK-007 (completed; registration API and Projects page)

## Desired outcome

A board member registers projects by picking them from a list of the git
repositories Moonbeam finds under the projects root. They can register several
at once, without typing any paths.

## Context

CONTRACT-004 B13 and ADR-006 decision 2 already say that registration "offers
the repositories it finds under the root, including nested layouts". TASK-006
and TASK-007 built registration by typed absolute path only. Nothing searches
the root. This task closes that gap.

On 2026-09-28 the board chose "pick from a list" over automatic registration.
A board member still chooses each project (B13), but can choose many in one
step. Moonbeam registers nothing on its own.

## Scope

### Included

- **Discovery (server, read-only):** an endpoint, for example
  `GET /api/projects/discover`, that searches the projects root and returns
  the git repositories found at any depth that are not already registered.
  - Each result gives the absolute path, the path relative to the root, a
    suggested name (the folder name), and a suggested main branch: `main` if
    it exists, else `master` if it exists, else the current branch.
  - Search rules (defaults; record them in the handoff):
    - A folder containing `.git` is a repository.
    - Don't descend into a repository once found.
    - Skip hidden folders and `node_modules`.
    - Don't follow symbolic links out of the root. Judge by real location, as
      registration does.
    - Cap depth and the number of folders visited. When a cap is hit, say so
      in the response (`truncated`), and don't fail.
  - The search changes nothing on disk.
  - Authority: humans and viewers may list. An agent credential is refused
    with `not_permitted`, because this reveals the file system outside any
    project. A missing projects root is a `validation` refusal with a clear
    message.
- **Projects page (UI):** a "Found in the projects root" list of unregistered
  repositories.
  - Checkboxes, "Select all", and an editable name and main branch per row.
  - "Register selected as <user>" registers each selected repository through
    the existing registration action. That keeps one audit record per project
    and the existing validation.
  - Show a result per repository. If some fail, the others still register,
    and each failure shows its reason.
  - The list refreshes after registering, and on demand ("Search again").
  - Keep the existing manual path entry as a fallback, behind "Add by path".
- Shared request and response schemas in `packages/shared/`.
- Tests:
  - Server discovery on a temporary folder tree: nested repositories, a
    repository inside a repository (not listed), hidden folders and
    `node_modules` skipped, a symbolic link outside the root not followed,
    already-registered repositories excluded, `truncated`, the agent refused.
  - Main-branch suggestion.
  - UI tests for select, register selected, and partial failure.
- `docs/DEVELOPMENT.md`: the endpoint and the search rules.

### Excluded

- Registering automatically, or on a schedule. That would need a contract
  superseding CONTRACT-004.
- Watching the file system for new repositories.
- Relinking moved projects, and changing the projects root.
- Cosmetic work beyond what the new list needs (board, 2026-09-28).

### Paths

- `packages/shared/`
- `server/`
- `ui/`
- `docs/DEVELOPMENT.md`

## Plan

## Acceptance criteria

- [ ] With a projects root that contains repositories at several depths, the
      Projects page lists every unregistered repository, and none that are
      registered or inside another repository.
- [ ] Selecting several repositories and choosing "Register selected"
      registers them all in one step. Each registration is audited and shown
      as a registered project.
- [ ] A failure on one repository doesn't stop the others, and its reason is
      shown.
- [ ] An agent credential cannot list discovered repositories.
- [ ] The search never changes files, and it finishes with `truncated` rather
      than failing or hanging on a large tree.
- [ ] `pnpm typecheck`, `pnpm test`, and `pnpm build` pass, with the database
      suite actually run.

## Validation requirements

`pnpm typecheck`, `pnpm test`, and `pnpm build`. The dispatcher runs the
database suite and a live check with a temporary projects root that holds
nested repositories, a repository inside a repository, `node_modules`, and a
symbolic link outside the root. The dispatcher also runs a read-only discovery
against the board's real projects root (`/home/patrick/Documents/Github`), to
check timing and results without registering anything.

## Risks and assumptions

- A large projects root could make the search slow. The caps and `truncated`
  bound it. Report the measured time on the board's real root.
- Assumes "not descending into a repository" matches how the team lays out
  projects. If the board wants repositories inside repositories listed, that
  is a later change.
- A suggested name can collide with an existing project name. The existing
  registration rules decide, and the UI shows the refusal for that row.

## Blocker

None.

## Implementation handoff

Not started.

## Review

Not reviewed.

## Human acceptance

Pending.

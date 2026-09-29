# Behavioral Contracts

Contracts describe approved observable behavior without prescribing unnecessary
implementation details. Name contracts `CONTRACT-NNN-short-description.md` and
link them from related tasks and ADRs.

An approved contract is never changed. Any change, however small, is a new
contract that supersedes the old one:

- The new contract has a new number, starts as `Status: Proposed`, and names
  the contract it replaces in a `Supersedes:` line.
- It is complete on its own: it carries every part of the old contract that
  still works, plus the fixes, so a reader never needs the old one. A short
  "Lineage" section says what it supersedes and what changed.
- IDs of carried items (transitions, invariants, questions) stay the same. New
  items get new IDs, and retired IDs are never reused.
- In the old contract only the status line changes, to
  `Status: Superseded by CONTRACT-NNN (date)`. Its body is left as it was.
- References to the old contract from other contracts resolve to the new one.

A contract can also be **shelved** by an ADR (ADR-008 introduced this):

- The contract governs no planned work, but it is not replaced by another
  contract.
- Only its status line changes, to `Status: Shelved by ADR-NNN (date)`. Its
  body stays as a record.
- It returns only through a new ADR.

Nothing in a contract changes silently during implementation. Questions found
during implementation go to the board, and the answers land in a superseding
contract.

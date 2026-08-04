# Decision 0001: Discover uses a scoped editorial language

- **Status:** Provisional
- **Scope:** `DiscoverPage`, `DiscoverDatasetPage`, and `DiscoverHeader`
- **Decision date:** 2026-08-04

## Context

The Discover experience presents a curated catalogue and detailed dataset
descriptions rather than the primary workspace and authoring interface. Its
current implementation uses a serif display face, monospace metadata, a dark
navy accent, and local warm-neutral values. Applying the application shell
mechanically would remove an intentional catalogue/editorial character before
the product has evaluated whether that distinction is valuable.

At the same time, undocumented local constants are easy to copy into unrelated
features or to remove as apparent design debt.

## Decision

Treat the Discover visual language as an intentional, provisional exception to
the core Satoshi-and-orange application system.

- It may retain its serif headings, monospace catalogue metadata, navy accent,
  and scoped neutral values.
- Those choices must not spread to workspace, upload, map authoring, story
  authoring, or general shared components.
- Shared behavioral and accessibility contracts still apply: semantic HTML,
  focus visibility, contrast, responsive composition, request states, and
  outcome-oriented language.
- A component shared with the application shell should consume the core system
  by default and expose a deliberate variant only when both contexts genuinely
  require the same behavioral contract.

## Consequences

The frontend temporarily has two related visual languages. This is acceptable
only because their scope is explicit. Discover constants remain candidates for
centralization within the Discover feature itself, not for addition to the
global theme.

Revisit this decision when Discover is redesigned, when its components need to
be reused elsewhere, or when user research shows that the distinction either
helps or harms comprehension.

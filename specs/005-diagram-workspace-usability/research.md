# Research

## Decision: Additive bulk component-count endpoint

The existing ADR list response does not expose component IDs, and the PostgreSQL list path loads each ADR and its links. A dedicated grouped count query avoids N+1 requests and avoids coupling canvas metadata to the ADR editor list.

## Decision: Independent count cache

The ADR store's `load` operation changes draft status and has no stale-response guard. Count state therefore lives in an independent diagram-scoped slice with retry and invalidation actions. Partial multi-request ADR saves invalidate counts after any server write attempt.

## Decision: Existing relationship routing with visual polish

The adapter already assigns deterministic reciprocal, parallel, and fan offsets. Retain the domain-owned route metadata and improve edge contrast, label backing, and selected state instead of introducing an obstacle-routing dependency.

## Decision: Panel state is UI-only

Library and Details visibility are transient workspace state. They do not enter `DiagramDocument`, undo history, persistence, or Mermaid export.

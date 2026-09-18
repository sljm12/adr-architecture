# Data Model and UI State

## ComponentAdrCount

| Field | Type | Rules |
|---|---|---|
| `componentId` | UUID | Must identify a component in the requested active diagram |
| `count` | positive integer | Number of linked persisted ADRs across all ADR statuses |

The endpoint returns only positive counts, sorted by `componentId`. Missing components have an implicit count of zero only after a successful response.

## Frontend count cache

The frontend stores the active diagram ID, a `Map<UUID, number>`, `idle/loading/loaded/failed` status, an error string, and a monotonically increasing request generation. The cache is invalidated on diagram switch/close, ADR persistence attempts, ADR deletion, restoration, and component-set persistence.

## Panel state

Library visibility, Details visibility, drawer mode, and the focus target for Linked ADRs are transient UI state. They are never serialized into diagrams.

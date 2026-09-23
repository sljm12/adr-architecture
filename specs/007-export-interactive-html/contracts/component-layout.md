# Existing Diagram Contract Change: Component Dimensions

The existing diagram read and write payloads retain their paths and artifact IDs. Each component gains a `size` object:

```json
"size": { "width": 180, "height": 72 }
```

Both values are positive, finite diagram units. New diagram responses always include `size`. Current clients send it when a component is created or resized. Legacy input without `size` is accepted and normalized to 180 by 72; supplied invalid dimensions return the existing field-specific validation error. The additive database migration gives existing component rows the same defaults. Position, relationship endpoints, group membership, and ADR links keep their existing UUIDs.

The editor updates `size` through normal diagram history and save behavior. Group boundary validation uses each member's normalized size. The HTML and standalone SVG export use the same normalized component geometry, so an export does not depend on transient React Flow measurements.

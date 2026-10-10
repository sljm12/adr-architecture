# Validation evidence — 2026-10-11

Branch: `011-export-presentation`. Active feature: `specs/011-export-presentation`.

## Passed

- 227 tests across 34 files: all shared tests (including scale/export/link validation), CLI export callers and frontend HTML-export callers.
- 10 offline browser checks across the installed Chrome and Edge executables: root/Container/Component navigation, local ADR links, keyboard focus, directory relocation, shared CSS editing/reload, typography sizes, actual SVG text bounds, Unicode/long fields, narrow layout, print CSS and independently styled standalone SVG.
- `npm run build`: shared/backend/CLI TypeScript and frontend production Vite build. Vite reported its large-chunk warning; build succeeded. The final layout change also passed all four TypeScript project builds.
- `git diff --check`.
- Visually inspected System Context, Container, Component, narrow-screen and ADR screenshots in `test-results/export-presentation/`.

## Commands

```powershell
node node_modules/vitest/vitest.mjs run shared/tests cli/tests/export-command.test.ts cli/tests/container-export-command.test.ts cli/tests/component-export-command.test.ts frontend/tests/html-export-button.test.tsx frontend/tests/container-html-export.test.tsx frontend/tests/component-html-export.test.tsx
npm run build
node node_modules/typescript/bin/tsc -b shared backend frontend cli
node node_modules/@playwright/test/cli.js test -c export-verification.tmp/offline.config.ts html-package-component.spec.ts html-package-portability.spec.ts --grep-invert "aggregate SVG and scoped Markdown" --reporter=line
```

The ignored local browser config reuses the existing offline projects, disables live servers for file-only fixtures and specifies installed Chrome/Edge paths. Logs are `export-reviewed-tests.log`, `export-reviewed-browsers.log` and `export-production-build.log` (ignored validation artifacts).

## Limits

- The initial full browser matrix could not launch Firefox/WebKit because their Playwright binaries are absent. Safari acceptance remains unverified on this Windows host.
- The existing persisted aggregate-download test requires a running application/database and was excluded from the final file-only run after connection refusal. No backend or persistence changes were made.
- Manually edited CSS changes styling throughout an extracted HTML package; SVG wrapping/coordinates remain fixed. Large font changes may require SVG adjustments. Standalone SVG uses independently editable resolved defaults for vector-editor compatibility.

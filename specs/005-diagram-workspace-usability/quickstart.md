# Validation Quickstart

1. Start the API and frontend with `npm run dev`.
2. Open a saved diagram at 1920x1080 and 1366x768. Confirm the page does not scroll, the canvas fills the remaining viewport, and Details starts closed.
3. Toggle the library and Details panels with mouse and keyboard. Select a node, open Add component, type a draft, close/reopen Details, and verify the draft remains.
4. Open library filters, search by name/date, sort, delete with confirmation, and open the library recovery entry point.
5. Create reciprocal/parallel relationships and a system group. Verify selected styling, readable arrows/labels, and a non-overlapping group header.
6. Link at least two ADRs to a component. Verify one bulk count request, a count badge, keyboard activation, Linked ADR focus, retry behavior, and refresh after save/delete.
7. Run `npm test`, targeted backend/frontend tests, and `npm run test:e2e -- --grep "workspace|ADR|group|diagram"`.

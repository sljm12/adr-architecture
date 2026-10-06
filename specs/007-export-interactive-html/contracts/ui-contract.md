# HTML Export and Offline Navigation Contract

**Date**: 2026-10-06. Follow DESIGN.md for existing controls and exported typography, spacing, colors and visible focus.

## Application export control

Keep the existing Export HTML package action. Its description explains that a System context includes active container diagrams and their ADRs; a directly selected child exports only itself. Capture retained state before source gathering. Block while relevant saves are in progress and while an export is already running. Announce gathering, validation/rendering, archive progress, success or actionable failure through the existing polite status region. Do not clear drafts, navigate, save, create children or restore trash. Keep Mermaid's separate saved-state rule.

## Offline diagram journey

- The entry page displays the selected context. Selecting a system by SVG or textual artifact link still shows its directly linked ADRs and empty state.
- System details show a distinct Open container diagram link when its child is included. Keyboard users reach it with ordinary Tab/Enter; no double-click is required. The action opens that child's page.
- Each bundled child shows Container diagram, its owning system name and a Return to System context link targeting the owner's parent component anchor. Scope must be identifiable without color alone.
- Selecting containers, external occurrences and relationships retains exact local ADR links. External Software System details offer Open container diagram only when their source's child is already in this package. No inheritance or scope expansion.
- Systems with none/trashed children say No active container diagram is included, with no create/restore/broken link. Directly exported children explain their scope and omit parent/sibling navigation.
- ADR browser entries and full views identify diagram scope; references locate the exact artifact in its owning page. All included diagrams link to the shared browser. Diagrams without local ADRs have a local empty state even if the catalog contains other diagrams' decisions.

## Accessibility and portability

Use readable labels, ordinary links, visible focus, text artifact indexes and sufficient default contrast. Diagram names/types/technology/responsibility and relationship description/protocol remain readable. One shared stylesheet recolors all HTML diagrams. Every journey works after extraction, relocation and opening from file URLs in current stable desktop Chrome, Edge, Firefox and Safari, without application/network access or scripts. Use normal browser settings; no local HTTP server, security-setting changes or privileged launch flags. Do not rely on an SVG editor to implement HTML package navigation.

Validate keyboard reachability and activation using each browser's native keyboard navigation, including visible focus after fragment/cross-page navigation. Calling a test locator's focus method does not prove a reader can reach that target. Text artifact links must provide a usable route in every browser even when SVG focus behavior differs. Acceptance covers both root and nested child pages, ADR backlinks, external-source child actions, local stylesheet reload and relocated directories. Record all four product-browser results under FR-025/SC-012.

# CodeBaseGPT Design System — MASTER

Source of truth for every surface (landing, auth, workspace). Derived from UI/UX Pro Max
(`--design-system "developer tool AI code intelligence dark"` + narrowed `color`, `landing`,
`chart` searches). Where the generated system conflicted with the product brief
(it proposed a green CTA and an FAQ landing pattern), the brief won and the verified
"night indigo + violet on dark" palette and "Product Demo + Features" pattern were used.

## Principles
1. **Evidence first.** Anything that came from the repository, the web, or the model is visually
   distinct (see *Provenance colors*). Never let model prose look like a verified fact.
2. **Workspace, not marketing.** Dense, calm surfaces; color is reserved for state and provenance.
3. **Keyboard-complete.** Every graph, list and dialog is operable without a pointer.

## Color tokens (dark default)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0B1020` | App background |
| `--surface` | `#11182B` | Panels, sidebar |
| `--surface-2` | `#172036` | Cards, inputs, hovered rows |
| `--border` | `rgba(148,163,184,0.14)` | Hairlines |
| `--border-strong` | `rgba(148,163,184,0.28)` | Inputs, focused panels |
| `--fg` | `#E6EAF2` | Primary text (15.8:1 on bg) |
| `--fg-muted` | `#94A3B8` | Secondary text (7.1:1 on bg) |
| `--fg-subtle` | `#64748B` | Tertiary/meta only, never body (4.6:1) |
| `--primary` | `#6366F1` (indigo-500) | Primary actions, focus ring |
| `--primary-strong` | `#4F46E5` | Pressed |
| `--accent` | `#8B5CF6` (violet-500) | AI / model output marker |
| `--info` | `#38BDF8` (sky-400) | Web evidence marker |
| `--success` | `#34D399` | Indexed, healthy |
| `--warning` | `#FBBF24` | Partial, heuristic |
| `--danger` | `#F87171` | Errors, destructive |

Light theme tokens exist (`[data-theme=light]`) for readability preference; dark is the default.

### Provenance colors (non-negotiable)
- **Repository evidence** — indigo left border + `FileCode` icon + `file:line` mono label.
- **Web evidence** — sky left border + `Globe` icon + domain label.
- **Model explanation** — violet `Sparkles` icon + "AI explanation" label; never styled as a quote.

## Typography
- Sans: **IBM Plex Sans** (400/500/600) — headings and body. Base 15px workspace / 16px landing, line-height 1.55.
- Mono: **JetBrains Mono** (400/500) — code, paths, line numbers, counts, keyboard hints.
- Scale: 12 (meta) · 13 (dense UI) · 15 (body) · 18 · 22 · 30 · 44/56 (landing hero only).
- Headings use `text-wrap: balance`; no all-caps except 11px tracked section eyebrows.

## Spacing, radius, elevation
- 4px base grid. Workspace density: 8 / 12 / 16 / 24. Landing: 24 / 48 / 96.
- Radius: 6 (controls), 10 (panels), 14 (landing feature frames).
- Elevation by border + 1-step surface change; one shadow only for overlays:
  `0 12px 40px -12px rgba(0,0,0,.6)`.
- No decorative glows. A single subtle radial indigo wash is allowed behind the landing hero.

## Motion
- 120ms (hover/press), 180ms (panels), 240ms (dialogs). Ease `cubic-bezier(.2,.8,.2,1)`.
- Exit faster than enter. Animate opacity/transform only.
- `prefers-reduced-motion: reduce` → transitions ≤ 1ms, graph `fitView` without animation.

## Graph (Codebase Atlas) conventions
- ≤ 500 rendered nodes (hard cap 400 by default; user can raise with filters). Beyond that,
  collapse into directory nodes and expand progressively.
- Node type is encoded by **shape + icon + color**, never color alone:
  directory = folder icon, rounded-rect, slate · file = file icon, rect, indigo ·
  class = `Box` icon, violet · function = `Braces` icon, sky · external package = dashed border.
- Edges: `--fg-subtle` at 50%; selected node's outgoing = indigo, incoming = amber; arrowheads always on.
- Accessible source of truth: the **Outline** view (tree + adjacency list) mirrors the graph and is
  fully keyboard navigable. Focusing a node in either view selects it in both.

## Charts (Insights)
- Recharts, categorical palette: `#6366F1 #38BDF8 #8B5CF6 #34D399 #FBBF24 #F472B6 #94A3B8`.
- Always: axis labels, tooltip, legend when > 1 series, a table alternative beneath.

## Components & interaction
- Buttons ≥ 36px tall in workspace (44px on touch breakpoints), visible 2px indigo focus ring offset 2px.
- Forms: visible labels, inline errors under fields, `aria-describedby`, disabled+spinner while submitting.
- Empty states: one sentence on why it's empty + the single next action.
- Skeletons for anything > 300ms; never spinners for full pages.
- Icons: lucide-react only, `aria-hidden` when decorative; icon-only buttons get `aria-label` + tooltip.

## Layout & breakpoints
- `sm 640 · md 768 · lg 1024 · xl 1280`. Test at 375, 768, 1024, 1440.
- Workspace: sidebar (240px, collapsible to 56px) + content. Under `lg` the sidebar becomes a sheet.
- Atlas: graph + detail panel side by side ≥ `lg`; below, detail panel is a bottom sheet.

## Landing pattern
Hero (value + 2 CTAs) → live product preview (interactive Atlas of a clearly labeled sample
graph) → three signature features → evidence/citations explainer → workflow
(import → index → explore → ask → learn) → responsible AI & privacy → footer.

## Anti-patterns
Emoji icons · gradient text everywhere · glowing cards · hover-only affordances ·
placeholder-only labels · color-only status · fabricated sample metrics without a "Sample" badge.

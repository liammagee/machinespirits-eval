# Machine Spirits house style

This is the local reference for making generated HTML look recognizably like
Machine Spirits. It is a deliberately portable distillation of the sibling
`../machinespirits-website` design system, with the existing Techne editorial
system retained as its long-form reading layer.

Use this reference for transcripts, reports, atlas pages, arcs, explainers, and
other generated HTML. Do not make a new palette or one-off visual language for
each generator.

## Source hierarchy

1. **Website identity:** `../machinespirits-website/markdown/dev/STYLE-GUIDE.md`
   and `../machinespirits-website/styles/main.css` define the visible house
   character.
2. **Website theme contract:**
   `../machinespirits-website/plugins/techne-theme-manager/techne-tokens.css`
   defines the portable surface, text, accent, and border roles.
3. **Local portable foundation:** `styles/machinespirits-house-style.css` is the
   dependency-free subset that generated artifacts in this repo should consume.
4. **Editorial extension:** `notes/poetics/assets/techne.css` adds the warm
   paper, Fraunces/Source Serif typography, evidence colours, marginalia, and
   component vocabulary used by the research atlas and dramatic-recognition arc.

The sibling website remains the upstream visual authority. The local CSS is a
versioned, reviewable copy rather than a runtime cross-repo dependency: generated
artifacts must still work in a fresh checkout and when opened offline.

## Identity invariants

Protect these. Together they make the design more than generic red-accented UI.

| Role | Contract |
|---|---|
| Core palette | black `#0a0a0a`, white `#ffffff`, off-white `#fafafa`, red `#E63946`, dark red `#c1121f` |
| Spatial rhythm | 60px primary Swiss grid, 180px accent grid, 15px micro-grid |
| Constructivist mark | restrained red cuts based on `--ms-slash-angle: -18deg` |
| Texture | subtle fixed monochrome noise; never a glossy gradient background |
| Display type | Helvetica Neue/system sans, very heavy, tight negative tracking |
| UI type | Space Mono/JetBrains Mono/system mono, small, uppercase, widely tracked |
| Geometry | sharp rules and square corners; black structural borders; red as action/accent |
| Interaction | crosshair cursor on exploratory pages; black or red inversion for active controls |
| Reading layer | warm Techne paper and serif prose only where sustained reading benefits from it |

Colour cannot carry meaning alone. Transcript roles and evidence states need a
text label, border treatment, or shape in addition to colour.

## Two artifact profiles

### Operational: transcripts, consoles, reports

Use the website foundation directly:

- white/off-white field with visible Swiss grids;
- large black sans-serif masthead and mono kicker;
- square black panels and tabs;
- signature red for selection, action, and structural emphasis;
- Techne moss/ochre/brick only as secondary semantic colours inside the content.

The tutor-stub transcript is the reference implementation.

### Editorial: atlas, arc, research explainers

Use `notes/poetics/assets/techne.css` and its documented components. The editorial
surface may use warm paper and serif reading type, but should retain the website
family resemblance through mono labels, strong rules, red/brick emphasis, and
structured Swiss-grid composition.

See `notes/poetics/TECHNE-DOCS.md` and
`notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html`.

## Reusing the portable foundation

For a self-contained Node-generated page:

```js
import {
  renderMachineSpiritsHouseBackdrop,
  renderMachineSpiritsHouseStyleTag,
} from '../services/machineSpiritsHouseStyle.js';

const html = `<!doctype html>
<html><head>${renderMachineSpiritsHouseStyleTag()}</head>
<body class="ms-house-style">
  ${renderMachineSpiritsHouseBackdrop()}
  <main class="ms-page">...</main>
</body></html>`;
```

For an HTML source that can load repository assets directly:

```html
<link rel="stylesheet" href="../../styles/machinespirits-house-style.css" />
<body class="ms-house-style">...</body>
```

The useful primitives are:

- `.ms-page` — raises content above the fixed visual layers;
- `.ms-kicker` — small mono eyebrow/metadata label;
- `.ms-display` — large tight display heading;
- `.ms-panel` — square black frame with a restrained red offset shadow;
- `.ms-tab` and `.ms-button` — house-style interactive controls;
- `renderMachineSpiritsHouseBackdrop()` — Swiss grids, red cuts, and noise.

Page-specific CSS should consume `--ms-*` tokens and add only the layout and
semantic components that page requires.

## Review checklist

- Is the upstream source named and the local snapshot self-contained?
- Does the page visibly use the Swiss grid, mono labels, strong rules, and red accent?
- Are headings and controls typographically distinct from reading text?
- Are panels square, legible, responsive, and usable without colour?
- Is texture restrained enough that dense content remains readable?
- Does reduced-motion and print output remain clean?
- Did the generator reuse the shared CSS/helper instead of copying another token block?

When the website changes materially, update this document and
`styles/machinespirits-house-style.css` together, then render representative
operational and editorial artifacts before accepting the refresh.

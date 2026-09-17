# Creance design mode: Mandate Ledger

## Architectural thesis

Creance should feel like a calm, exacting operations room. The interface uses editorial typography and paper-like surfaces to make policy legible, then reserves green, amber, and red for state. The visual system is deliberately 2D: treasury review is a dense decision task, so spatial decoration would compete with evidence.

### Design brief

| Field | Decision |
| --- | --- |
| Product | Web-based treasury control plane |
| Primary action | Review an intent, understand the reason, and approve only when the mandate permits it |
| First-five-second message | Capital moves only when the mandate agrees |
| Audience | Treasury owners and operators who work comfortably with financial and technical terminology |
| Form factors | 390px mobile through 1440px desktop |
| Dimensionality | 2D planar interface for data density, accessibility, and low GPU cost |
| Motion budget | Restrained, functional state changes under 350ms |

## Tokens

| Category | Token |
| --- | --- |
| Canvas | `#f4f0e7` warm bone |
| Panel | `#fffcf6` opaque paper |
| Ink | `#14221f` deep green-black |
| Secondary text | `#61706a` sage gray |
| Pass | `#176b4a` |
| Warning | `#b96e12` |
| Failure | `#a43d2d` |
| Display | Fraunces, 600 to 700 |
| Body | Manrope, 400 to 700 |
| Technical | DM Mono, 400 to 500 |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64px |
| Motion easing | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Motion duration | 180ms micro, 280ms standard |

### AMOLED variant

The dark variant uses a true black canvas (`#000`) to respect OLED energy behavior, with deep green-black evidence panels and high-contrast type. Glass is restricted to navigation and action chrome: translucent controls use blur, a one-pixel specular edge, and an inset highlight. Policy evidence cards remain opaque so blur never reduces legibility.

| AMOLED token | Value |
| --- | --- |
| Canvas | `#000000` |
| Panel | `#0b0d0c` |
| Ink | `#f4f7f5` |
| Secondary text | `#a3b2ac` |
| Divider | `#29312e` |
| Pass | `#63d09d` |
| Warning | `#e6a957` |
| Failure | `#f08171` |
| Glass fill | `rgba(255,255,255,.075)` |
| Glass border | `rgba(255,255,255,.17)` |
| Glass blur | `blur(18px)` |

### Watermelon UI adaptation

Creance borrows Watermelon UI's source-backed dashboard vocabulary: compact status controls, clear component boundaries, strong section headings, and stateful animated feedback. The current Vite app is vanilla HTML, CSS, and JavaScript, so these patterns are implemented as local primitives instead of adding a React registry dependency. The reference library is used for composition and interaction guidance, not copied as a default theme.

## Interaction contract

- A blocked state explains the violated constraint in plain language and preserves the exact code for operators.
- A permitted state changes the semantic color and exposes approval only after evaluation.
- Approval appends a decision event and disables itself to prevent duplicate intent submission.
- Once an intent executes, the evaluator, mandate slider, and approval control stay disabled for that intent.
- New audit events use a short opacity and translate reveal. This movement communicates chronology, not decoration.
- Reduced-motion users receive the same state updates with no translation or delay.

## Anti-pattern decisions

Creance avoids purple gradients, glassmorphism, decorative icon grids, cursor-following effects, and universal scroll reveals. Those patterns would make a policy product feel like a marketing surface and reduce confidence in the evidence.

## Responsive behavior

- Desktop: asymmetric two-column review workspace with the proposal as the dominant surface.
- Tablet: stacked proposal and mandate panels while preserving the evidence order.
- Mobile: single-column metric stack, compact facts grid, and a readable audit trail with non-essential hashes hidden from the narrow layout.

# Design System

Single source of truth for UI consistency. Code is canonical; Claude Design is an optional mirror.

## Structure

- `tokens.css` - color, spacing, type, radius, shadow tokens (CSS custom properties, light and dark)
- `components/` - reusable components and their stories
- `../docs/index.html` - static widget demo that consumes the generated bundle

## Rules

- No hard-coded colors, spacing, or font sizes outside `tokens.css` (Stylelint enforces colors).
- New component: add it under `components/` with a story, and use tokens only.
- Must meet WCAG 2.1 AA contrast in light and dark.
- Changing a token is a visible change: update `CHANGELOG.md`.

## Storybook

```bash
npm run storybook
npm run build-storybook
```

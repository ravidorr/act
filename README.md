# Pendo Act POC (Client-side, JavaScript)

This POC produces a single JS bundle and a CSS file to load in your Pendo Resource Center as a custom module, enabling a chat/quick-action UI and a client-side automation agent that can click/type/select/navigate in the current app.

Key points:
- JavaScript only (no TypeScript).
- No inline CSS in HTML or JS-rendered elements; styles live in styles/act-widget.css.
- Client-side agent with allowlist guardrails and confirmation modal for risky actions.

Build

1) Install deps (esbuild is already added):
   npm install

2) Build once:
   npm run build
   Outputs dist/act-widget.js and dist/act-widget.css

3) Preview locally (static):
   npm run preview
   Then open http://localhost:8080 and test loading dist/act-widget.js in a simple page.

Using in Pendo Resource Center

- Host dist/ on a static URL you control (e.g., GitHub Pages or your CDN).
- In Resource Center, create a custom code module and set the JS URL to your hosted dist/act-widget.js.
- The widget will auto-load its CSS from the same path (dist/act-widget.css).
- In your module’s custom JS snippet, call:

  window.PendoAct.boot({
    // Optionally restrict navigation
    allowlist: [new RegExp('^' + location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))]
  });

Notes
- Sample quick action: Workday “Take a day off next Monday” using high-level selectors. Final Submit is intentionally left to the user for POC safety.
- You can map more quick actions by adding files under src/tasks/ and referencing them in src/index.js or ui/widget.js.
- For development, use npm run dev to watch/rebuild JS, then re-copy CSS on changes via: cp styles/act-widget.css dist/act-widget.css


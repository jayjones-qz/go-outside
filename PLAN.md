# go-outside — Plan

Status: **draft, collecting requirements**. No code yet.

## Goal
Single-page TypeScript/React app, deployed on Vercel, rendered inside an iFrame by a host ("activity_item"). Reads flashcards from the URL query and displays them.

## Stack (proposed)
- **Vite + React + TypeScript** (static SPA; no server needed). Decided.
- **pnpm** (local: pnpm 11.5.1, node 24.16.0).
- **Vitest** for the URL parser (the riskiest part).
- Vercel: framework preset `vite`, output `dist/`. Deploy via Git integration: team `jay-demo-team`, project `go-outside`, repo `github.com/jayjones-qz/go-outside` (public, empty). Push to `main` → production; PRs → preview deploys. Import at https://vercel.com/new?teamSlug=jay-demo-team (manual, browser).
- Deployed origin (likely `https://go-outside.vercel.app` or `https://go-outside-jay-demo-team.vercel.app`) → plug into host listener origin check after first deploy.

## Input contract (from host instructions)
```
{baseUrl}?cards=[{id:activityItemId,front:"...", back:"..."}]
```
- Max 10 cards.
- Base64 only "if that format is too hard to serialize to be url-valid".

### Risk: format is ambiguous
The host was given a JS-object-literal example (unquoted keys), not strict JSON. Actual output is unknown until follow-up. Parser must therefore accept, in order:
1. Raw `cards` param (already URL-decoded by `URLSearchParams`).
2. Strict `JSON.parse`.
3. Relaxed parse: quote bare keys (`id:` → `"id":`), single → double quotes. No `eval`.
4. Base64 — standard (`+/=`) and URL-safe (`-_`, no padding); then retry 2–3. Decode as UTF-8 (`TextDecoder`), not raw `atob`, so non-ASCII card text survives.
5. Double-encoding (`%5B...`) — one extra `decodeURIComponent` pass.

Validation: array; each item has `front`/`back` strings; `id` string|number (coerce to string). Drop invalid items, truncate to 10. Parse failure → friendly error state (+ console detail for debugging).

Update this section once the real format is known.

## iFrame embedding
- Do **not** send `X-Frame-Options`.
- `vercel.json` header `Content-Security-Policy: frame-ancestors 'self' https://quizlet.com https://*.quizlet.com http://localhost:*`. (`*.quizlet.com` does not match bare `quizlet.com`, so both listed.)
- Layout fills the frame: `html, body, #root { height: 100% }`, no fixed page width.
- No reliance on third-party cookies / `localStorage` (may be blocked in cross-site iframes).

## Host messaging (iframe → host)
Contract defined here (host has no existing expectation). Send to host once finalized.

Only **correct matches** are reported. One message per match:
```ts
type MatchMessage = {
  source: "go-outside";
  version: 1;
  type: "match";
  activityItemId: string; // card `id` from the URL
  elapsedMs: number;      // ms from game start (first render with cards) to this match
  ts: number;             // epoch ms (Date.now())
};
```
Host listener:
```js
window.addEventListener("message", (e) => {
  if (!/^https:\/\/go-outside[\w-]*\.vercel\.app$/.test(e.origin)) return; // adjust to deployed origin
  const m = e.data;
  if (m?.source !== "go-outside" || m.type !== "match") return;
  // m.activityItemId, m.elapsedMs
});
```
- Sent via `window.parent.postMessage(msg, targetOrigin)`.
- `targetOrigin`: parent origin from `location.ancestorOrigins[0]` (Chrome/Safari) or `document.referrer` (Firefox), validated against the frame-ancestors allowlist. Never `'*'`. Not framed (`window.parent === window`) → `console.debug` only.
- Timing: `performance.now()` deltas (monotonic) for `elapsedMs`.
- Deferred (add only if asked): wrong attempts, `ready`, `complete`.
- Test harness: local `harness.html` that iframes the app and logs received messages.

## Game design (8-bit memory/matching game)

### Look
- Pixel art, palette close to Quizlet brand. Palette (confirmed): indigo `#4255FF`, deep indigo `#423ED8`, yellow `#FFCD1F`, navy `#0A092D`, slate `#282E3E`, off-white `#F6F7FB`, plus per-theme naturals (greens, sands, browns, water blues).
- Font: `Pixelify Sans` via `@fontsource/pixelify-sans` (self-hosted, OFL; readable lowercase for card text).
- Low internal resolution (e.g. 320×180), integer-scaled to fill the iframe; `image-rendering: pixelated`. Letterbox to keep aspect ratio.

### Scene
- **Seeded**: seed = hash of the card set (ids + fronts) → deterministic PRNG (mulberry32). Same cards → same scene.
- **Theme** picked from seed: `desert`, `tropical`, `cedar-forest` (extensible list). Theme controls palette, tree species, sky, ground, decor.
- **Background (animated, non-interactive)**: waterfall, ambient birds, clouds, theme-specific decor (cacti/dunes, palms/surf, mountains/mist). Placement random from seed.
- **Foreground**: always one big tree. Branch count = card count (≤10). Each branch holds a small sign showing a card **front**.

### Birds
- One bird per card; each bird "carries" one card **back**.
- Idle behavior: hop on ground, fly to/from the tree, perch on unoccupied spots.
- Speech: one speech bubble per bird, showing its card back.
  - Click bird → it speaks.
  - Idle auto-speak: if no user click for ~10s, a random unmatched bird speaks.

### Matching
- **Drag** a bird onto a branch sign, **or** while a bird is speaking, **click** a branch → bird flies there.
- Correct (bird.cardId === branch.cardId): bird lands, flaps wings, stays seated (matched, no longer interactive).
- Wrong: bird falls off branch, returns to idle.

### Rendering approach (proposed)
Layered:
1. `<canvas>` background — procedural scenery + ambient animation, `requestAnimationFrame` loop.
2. DOM/SVG layer for interactive objects (tree branch signs, birds, speech bubbles) — absolutely positioned in the same scaled coordinate space. Reasons: card text wrapping, pixel font rendering, hit-testing, Pointer Events drag (mouse + touch), keyboard/a11y.
- Sprites: hand-authored pixel matrices in TS (no image assets) recolored per theme — unless assets are provided.
- Game state in a reducer (`useReducer`); animation timers/positions in refs to avoid re-render churn.

### Edge cases
- Long card text vs. tiny signs/bubbles → truncate + expand on hover/click, or scale text (TBD).
- 1 card / 10 cards layout: branch positions generated to fit N.
- Duplicate fronts or backs across cards.
- Empty/error state when `cards` missing or unparseable (themed, e.g. empty tree).

## Files (planned)
```
package.json
vite.config.ts
tsconfig.json
vercel.json              # headers (frame-ancestors)
index.html
src/main.tsx
src/App.tsx
src/parseCards.ts        # tolerant URL parser
src/parseCards.test.ts
src/rng.ts               # seed hash + mulberry32
src/themes.ts            # theme defs + palettes
src/sprites/             # pixel matrices: tree, birds, decor
src/scene/Background.tsx # canvas layer
src/scene/Tree.tsx       # branches + signs
src/scene/Bird.tsx       # bird sprite, behavior, drag
src/scene/SpeechBubble.tsx
src/game/state.ts        # reducer: matched, speaking, dragging
src/styles.css
```

## Verification
- Unit tests: JSON, relaxed literal, base64 (std + url-safe), unicode, >10 cards, garbage input.
- Local: `pnpm dev` with sample URLs; test inside a local `<iframe>` harness page.
- Deploy preview on Vercel; load in the real host.

## Open questions
See `Questions.md`.

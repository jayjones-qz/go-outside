# Open questions

- [x] 1. Framework → Vite SPA.
- [x] 2. frame-ancestors → `https://quizlet.com https://*.quizlet.com http://localhost:*`.
- [x] 3. App purpose → 8-bit tree/birds matching game (see PLAN.md "Game design").
- [x] 4. Host messaging → yes, `postMessage` matches + timing (see PLAN.md "Host messaging").
- [x] 4a. Only correct matches reported; fields: `activityItemId`, `elapsedMs`, `ts`.
- [x] 4b. Contract defined here; host only needs `activityItemId` on match.
- [x] 5. Palette confirmed: `#4255FF #423ED8 #FFCD1F #0A092D #282E3E #F6F7FB` + theme naturals. Font: `Pixelify Sans` (OFL, via `@fontsource`, self-hosted) — default, no brand font supplied.
- [x] 6. Deploy → Vercel Git integration. Team `jay-demo-team`, project `go-outside`, repo `jayjones-qz/go-outside` (exists, empty, PUBLIC). Import via https://vercel.com/new?teamSlug=jay-demo-team.
- [x] 7. Git initialized; remote `git@github.com:jayjones-qz/go-outside.git`, branch `main`.
- [~] 8. Win state → default: "All birds are home!" panel + elapsed seconds + "Play again" (resets birds; re-sends matches on replay).
- [~] 9. Wrong match → default: bird wobbles + falls; no penalty/counter; not reported to host.
- [~] 10. Long text → default: signs clamp to 2 lines, expand on hover/focus; bubbles truncate at 140 chars. Images unsupported.
- [~] 11. Sound → default: none.
- [~] 12. Sprites → default: hand-coded pixel matrices in TS (`src/sprites.ts`, canvas drawing in `src/scene/drawScene.ts`).
- [~] 13. Keyboard → default: birds + signs are buttons (Tab, Enter speaks / sends speaking bird).
- [~] 14. Themes → default: desert / tropical / cedar-forest (`src/themes.ts`).
- [x] 15. Interaction → clicks are the required path (click bird → click branch). Drag also implemented + verified; can be removed.

`[~]` = default chosen during implementation, not yet confirmed.

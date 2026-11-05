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
- [ ] 8. Win state: what happens when all birds are matched (celebration, replay, reshuffle)?
- [ ] 9. Wrong match: any penalty/score/attempt counter, or just the fall?
- [ ] 10. Long text: truncate+expand, shrink-to-fit, or cap characters? Images in cards ever?
- [ ] 11. Sound effects / chiptune music? (Autoplay is blocked in iframes until a user gesture.)
- [ ] 12. Sprites: hand-coded pixel art in TS OK, or will art assets be supplied?
- [ ] 13. Keyboard/accessibility requirements (e.g. Tab to bird, Enter, Tab to branch)?
- [ ] 14. Theme list: desert / tropical / cedar-forest final, or add more (snowy, autumn, night)?

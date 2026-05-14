# Anchor Prototype

Anchor is a daily stability operating system. This first prototype is intentionally small and local-only: it tracks just enough behavior to interrupt spirals and recommend one grounding action.

## Open It

Open `index.html` in a browser.

When GitHub Pages is enabled, open:

`https://aspurand.github.io/anchor/`

On mobile, use the browser share menu to add Anchor to your home screen as a PWA.

## Built In This Pass

- Daily Anchor Score from sleep, movement, meals, outdoors, social contact, creative time, screen loop, and mood check-in.
- Home-screen widget mockup with score, status, and next action.
- Mood check-in that routes back to body regulation before analysis.
- "I'm spiraling" reset flow: fear, fact vs story, body reset, no-text delay, recheck, log.
- Relationship anxiety trigger log, reassurance tracking, pattern summary, and message reframer.
- Real Life Missions.
- Personal project reminder.
- Evening review.
- Local browser storage only. No account, backend, analytics, or cloud AI.
- PWA manifest, icons, and service worker for home-screen install and offline loading.

## Next Build Step

Turn this prototype into an Expo app shell with the same screens and local storage first. Add Supabase only after the core flows feel useful.

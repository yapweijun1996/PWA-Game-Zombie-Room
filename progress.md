Original prompt: Implement the approved endless difficulty director plan: 25-second waves, four-wave stages, seeded encounters, bounded pacing relief, telegraphed spitters, replay schema 4, and verified mobile/PWA behavior.

## Implementation notes

- Preserve pre-existing README and browser-test changes for explicit headless pointer capabilities and profile cleanup retries.
- Target familiar players feeling significant pressure at 3–5 minutes; human enjoyment and timing remain unverified until real playtests.
- Initial scope was plan A. The next user selection authorizes plan B build branches; optional missions, deployment, and score resets remain out of scope.
- Spawn coefficients represent rates: divide the base interval by the coefficient (a 0.25 rate creates a longer interval).

## Progress

- Baseline reviewed; the pure director and isolated ranged-combat rules are integrated.

- Implemented director ownership, seeded encounter bags, bounded relief/recovery, and spitter combat with swept collision.
- Added replay schema 4, director event comparisons, localized HUD, historical best-score disclosure, PWA cache/version update, and opt-in manual simulation hooks.
- Existing pointer-emulation/scenario-isolation fixes were committed externally during implementation; retained them and extracted only reusable browser harness utilities.
- Final full suite: all 29 tests passed with Chrome required, no skips. Includes telegraph/collision consistency, seven-language refresh, and legacy-score migration.
- The original replay fixture now actively collects XP and records for 25 seconds. The slower buildup rate made its old assumption of an incidental upgrade within 15 seconds unreliable; gameplay balance was not changed to satisfy the fixture.
- Six synthetic 300-second runs all survived fully upgraded with full HP/shield. Only 1–18 spitter shots occurred. This is a balance risk; preserve initial approved constants and report the human difficulty target as unverified.
- Controlled 10/20-minute fixtures and a saturation fixture passed. Offline startup passed after ordinary reload; a hard reload deliberately bypasses the service worker and is unsuitable for that assertion.
- Inspected portrait, landscape, desktop, and blackout/ECO screenshots. The supplied game-skill Playwright client completed without page errors. Final diff and whitespace checks passed.
- Skill reflection: timing, event ownership, and fixture isolation are captured in project tests/docs; no global skill update is needed.

## Remaining validation

- Human 3–5-minute pressure/enjoyment acceptance and physical-device testing remain outstanding.

## Build branches (user selected option C)

- Implement three exclusive paths at level 4 (Arc, Scatter, Mobility), two specializations per path at level 8, and path-specific evolutions. Reuse the upgrade modal and recorded upgrade events.
- Keep choices and derived combat stats in a pure builds module; player owns run selections and burst timers. The director remains unchanged.
- Validate branch mechanics, unlock/queue boundaries, pause/reset, all seven locales, mobile/landscape/desktop modal usability, exact replay, and offline module caching.
- Baseline before this work: 29 automated checks passed. New branch balance and enjoyment require fresh evidence.

- Implemented all three paths, six specializations, exclusive evolutions, localized selection/prerequisite UI, build snapshots/analysis, and v3.7 cache/score compatibility.
- Fixed piercing repeatedly hitting the same enemy; bullet properties now snapshot the build at firing time. New targeted unit/browser checks pass.
- Screenshot inspection found the legacy HUD/message layers covering modal titles in landscape. Raised only the active upgrade overlay and added a layering regression.
- Nine seeded runs (three seeds × three policies) reached five minutes; every path recorded/replayed exactly. This remains synthetic evidence, not validation of fun or the pressure target.
- Final visual checks, regression rerun, and diff review are complete.

- Added an actual-scrolling 667×320 case. It exposed Tab wrapping focus to an offscreen first card; dialog focus wrapping now reveals its target with nearest scrolling. The focused browser regression passes.
- Skill reflection: keep the shared focus/scroll lesson in the regression and this project log; no new global skill is needed.

- Final visual review also caught arc particles losing coordinates after their first update: their stationary velocity was missing. Set both components to zero and verified finite coordinates across frames plus visible arcs in screenshots.
- Reserved HUD space for the path icon and player level on narrow screens. Added a visibility regression; targeted combat/layout tests pass across five viewports.

## Build delivery result

- DONE: v3.7.0 build paths, specializations, path-specific evolutions, compatible recording/analysis, localization, score preservation, and offline precache are implemented.
- Verification: `PLAYTEST_BROWSER='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PLAYTEST_REQUIRE_BROWSER=1 node --test tests/*.test.mjs` passed all 38 tests with no skips on the final source. `git diff --check` passed.
- Inspected all three combat styles and portrait/short-landscape/desktop selection screenshots. The supplied Playwright client finished with no page errors.
- Remaining: physical-device use, native-speaker review of new translations, and human fun/pressure acceptance. Automated policies still survived all nine five-minute runs; do not claim the 3–5-minute pressure target is met.

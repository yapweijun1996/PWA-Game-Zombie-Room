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

## Mobile audio, input, and upgrade flow (v3.8)

- User reported silent music/effects and no vibration in iOS standalone PWA, a fixed-location joystick on phone, forced language selection when Settings opens, and requested optional automatic upgrade choice.
- Added procedural background music (the app previously had no music track), independent persisted music/effects settings, and Web Audio unlock/recovery on touch, keyboard, page restore, and foreground return.
- On platforms with no `navigator.vibrate`, Settings disables the Haptics switch and explains the browser capability limit. iOS Taptic Engine cannot be invoked from the current web/PWA API surface; a physical iPhone check is still required for all mobile behavior.
- Mobile movement now starts from one touch anywhere in the non-interactive play area, with the joystick anchored under that finger and Dash left as a separate button.
- Upgrade dialogs now offer a three-second first-choice timer with progress; it can be stopped in the dialog or persisted from Settings. The timer pauses when the page is hidden and uses normal upgrade recording/replay logic.
- Settings initial focus now goes to the Sound switch instead of the language `<select>`, preventing iOS from opening the native language picker on panel open.
- Bumped the app/service-worker cache to v3.8.0, retained stored scores/settings, and added browser checks for mobile touch origins, timer behavior, Settings focus, haptic capability UI, music setting persistence, and offline music caching.
- Complete: all 39 checks passed with Chrome required and no skips; this includes the existing 1,000-wave/director, build, replay, and offline tests plus new touch-origin, audio-unlock/music-toggle, haptics-capability, Settings-focus, and auto-upgrade regressions.
- Inspected 390×844 mobile Settings and upgrade-dialog screenshots. Automated browser checks also cover short portrait, landscape, and desktop layouts.
- The supplied game Playwright client could not load because its `playwright` package is absent from the local skill runtime; the repository's Chrome DevTools browser suite and direct screenshots provided the UI verification instead.
- Published v3.8.0 to `main` and confirmed the GitHub Pages `verify` and `deploy` jobs passed. Checked the live page, service worker, and music module over HTTPS; all returned HTTP 200 with the v3.8.0 release markers.
- Remaining real-device check: confirm audible music/effects and standalone lifecycle on the user's iPhone. iOS web content still has no Taptic Engine access, and human usability is not established by browser tests.

## Build delivery result

- DONE: v3.7.0 build paths, specializations, path-specific evolutions, compatible recording/analysis, localization, score preservation, and offline precache are implemented.
- Verification: `PLAYTEST_BROWSER='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PLAYTEST_REQUIRE_BROWSER=1 node --test tests/*.test.mjs` passed all 38 tests with no skips on the final source. `git diff --check` passed.
- Inspected all three combat styles and portrait/short-landscape/desktop selection screenshots. The supplied Playwright client finished with no page errors.
- Remaining: physical-device use, native-speaker review of new translations, and human fun/pressure acceptance. Automated policies still survived all nine five-minute runs at that time (superseded by the 3.8.4 and 3.8.5 results below); do not claim the 3–5-minute pressure target is met.

- Reworked audio (v3.8.1): shared compressor master bus, noise-textured SFX with voice caps, and a fuller 8-bar E-minor BGM with bass, arpeggio and soft drums. Full test suite passes.
- v3.8.2: service worker navigation no longer rewrites the cached shell, so error pages are not cached and a new index.html is never paired with an older module set.
- Version single source: `src/state.js` APP_VERSION. `index.html` no longer hardcodes it (label is set at runtime), browser tests read it from `state.js`, and `tests/version.test.mjs` fails if `service-worker.js` drifts.
- v3.8.3: split `render.js` (1506 lines) into `render.js` (draw entry + bullets/orbs), `render-scene.js` (grid, lighting, obstacles, hazards), `render-actors.js` (player, zombies, spitters, telegraphs) and `render-hud.js` (pickups, threat radar); pure code move, dependencies are one-way from `render.js`. New modules added to the service-worker shell. `index.html` keeps the pre-render version label, now guarded by `tests/version.test.mjs`. Test harness treats macOS `EPERM` from the process-group kill as "already gone" (this was the intermittent browser-test failure).

## Gameplay/codebase review — 2026-10-17

- Request: review the level difficulty after “too easy” feedback, review the codebase, list bugs, and update Markdown. Scope is review/documentation; no game, tuning, test, version, score, commit, or deployment changes.
- Reviewed `ce22076` / app 3.8.3. Added [GAMEPLAY_REVIEW.md](GAMEPLAY_REVIEW.md) as the authoritative current finding register and linked it from README.
- Found 11 confirmed defects: pillar pursuit deadlocks, PWA version mixing, player bullet cover collision, exhausted upgrade queues, post-hazard-death mutation, capped blackout rewards, invisible short-viewport play space, automatic-selection re-enabling, Settings keyboard interception, false clipboard success, and a missing maximum-level translation key. At review time all remained open with reproduction and acceptance checks; all 11 were fixed in 3.8.4 (below).
- Kept six balance/UX concerns separate from implementation defects: damage/durability growth, Boss closing speed, spawn-floor timing, active-Boss threat suppression, recovery/economy, and obstructed auto-targeting.
- Required-Chrome suite: 41 passed, 0 failed, 0 skipped. Nine existing world-aware runs again reached 300 seconds at 225 HP/40 shield. Six simpler first-card/no-Dash square-movement trials produced three full-health 300-second survivors and three deaths at 82.25–131.45 seconds; an independent harness repeat matched all six.
- Recorded a headed/headless mobile discrepancy: the same nominal viewport/seed had different rendered room bounds and a different survival outcome. Compare actual room geometry and runtime, not seed alone. This limits extrapolation to human/device difficulty.
- Controlled browser probes and a service-worker VM fixture reproduced the reported defects. Inspected the mobile defeat screen; all seven locales return the missing `upgradeMaxLevel` key unchanged. Existing passing tests do not cover these failures.
- Remaining work: fix the documented defects in a separately requested implementation, add focused regressions, establish a measured survival/pressure target, and validate familiar-player pressure plus physical-device/update behavior. The earlier v3.8.2 note does not establish complete cache-version coherence; F02 supersedes that assumption.

## Gameplay review fixes and difficulty tuning — v3.8.4

- Fixed all 11 findings from [GAMEPLAY_REVIEW.md](GAMEPLAY_REVIEW.md): enemy obstacle routing; release-coherent service-worker caching; swept, ordered player-shot impacts and visible targeting; complete queued-upgrade fallback; immediate stop after lethal hazards; guaranteed bounded blackout drops; short-viewport bounds; auto-pick re-enabling; Settings keyboard focus; truthful clipboard results; and seven-locale maximum-level labels.
- Added focused unit/browser regressions for the defects, including all four obstacle faces, cover corner sweeps, 0/7/8 pickup pools, 1280×320 layout, mid-dialog auto-pick enable, clipboard unavailability/rejection, and all seven translations.
- Increased late-wave and Boss health growth, lowered the spawn floor to 0.18 seconds, raised phase pressure, allowed spitter support during a carried Boss, accelerated Boss charges, raised the ordinary movement cap, and shortened shield recovery, director relief, and post-Boss recovery. Fallback level-ups and Vitality heal 25 HP each.
- Fixed-seed world-aware browser trials: 8/9 reached the 300-second cap, with 1/9 dying at 129.38 seconds; damage-event exposure rose to as many as 20 in those samples. First-card/no-Dash square movement reached 300 seconds in 1/6 trials; the other five died between 43.95 and 178.02 seconds. These are synthetic stress comparisons, not human acceptance.
- Human 3–5-minute pressure/enjoyment, physical-device controls, every enemy/cover combination, and a deployed two-release PWA update cycle remain unverified.

## Compounding durability and skippable upgrades — v3.8.5

- Feedback: still too easy; players want level-ups to auto-select without the dialog. Owner delegated testing and tuning decisions.
- Diagnosis with a 600-second probe (six seeds; world-aware Offense and First-card policies at 390×844; no-Dash square movement at 1200×685 and 390×844): on 3.8.4 the world-aware controller never fell below 80% effective HP (HP + shield) in 11 of 12 runs and averaged only 5–12 live enemies even at 600 seconds against a 90-enemy cap. Upgrades multiply player damage, while enemy health grew linearly, so late spawns died before reaching the player.
- Candidates: ×1.06 per wave after wave 4 changed almost nothing; ×1.12 and ×1.18 after wave 4 only bit after about 450 seconds; ×1.20 after wave 2 killed the world-aware First-card policy at 129–151 seconds. Chose ×1.16 per wave after wave 2 (`lateHealthGrowth`/`lateGrowthAfterWave` in `DIRECTOR_CONFIG`), applied to normal and Boss health; waves 1–2 are unchanged.
- Level-ups now skip the dialog by default (`zombie-room-upgrade-skip`) and choose without pausing; Settings has a toggle and the dialog has "Skip all — auto-select from now on". Seeded playtests keep the dialog so synthetic controllers and replays choose explicitly. Seven locales added; on screens up to 450px tall the keyboard hint is hidden and dialog controls are compact so a full choice card stays visible.
- The no-Dash regression now guards the opening (at least four of six cases outlast 90 seconds, the same count as 3.8.4) instead of requiring a 300-second survivor, which the intended harder late game removes.
- Evidence and limits are recorded in [GAMEPLAY_REVIEW.md](GAMEPLAY_REVIEW.md#difficulty-tuning--385). Human pressure/enjoyment, physical devices, and the default auto-select's effect on build variety remain unverified.
- Owner target (2026-10-21): about three minutes should already feel hard; skipping stays on by default for everyone.
- Automatic picks choose a random build path and specialization, take an offered evolution, and otherwise prefer upgrades the current path's evolution still needs (before this, index 0 always chose Arc). Enabling skip in Settings resolves an open dialog; the countdown toggle is disabled only while dialogs are actually skipped.
- Real-time end-to-end play: a scratch script opened an ordinary unseeded session at 1200×685 with real CDP keyboard input and a human-like policy (250ms reactions, flee nearby enemies, dash when two are close). Level-ups never opened the dialog or paused, the defeat screen appeared, and there were no runtime exceptions. Results: 3.8.4 survived past 230 game-seconds in 3/3 runs at 125–225 HP; 3.8.5 died at 113, 124 and 193 seconds. ×1.22 per wave died at 112, 118 and 141 seconds. It barely changed the 2-minute wall, while it killed the world-aware auto-pick controller at 122–148 seconds on half the seeds, so ×1.16 was kept.
- Found during that play: any direction key at the moment of death, including key-repeat, or the next tap restarted the run instantly and skipped the defeat screen. Input restarts now wait 1.2 seconds after death and ignore key-repeat; the Restart button is unchanged.
- The survival rank was inflated: kills were counted twice, so a two-minute death ranked S. Rank is now based on the wave reached: B from wave 4, A from wave 8 (about 3 minutes), S from wave 13 (5 minutes).
- The director browser test advances synthetic runs and replays in slices; crowded late waves had exceeded the 15-second DevTools command timeout.

- Required-Chrome suite on the final 3.8.5 source: 54 passed, 0 failed, 0 skipped (`PLAYTEST_REQUIRE_BROWSER=1 node --test tests/*.test.mjs`).

## Harder from wave 2 — v3.8.6

- Owner feedback after playing 3.8.5: still too easy, make it harder.
- Enemy contact, Boss and spitter-projectile damage now scale by +9% per wave (`DIRECTOR_CONFIG.damagePerWave`, exposed as `plan.damageScale`). Before this, a walker hit for 11 at every wave against up to 225 HP plus a regenerating shield. Health compounding is raised to ×1.20 per wave after wave 1 (wave 8 health ≈ 7.4×, wave 12 ≈ 20.9×).
- 360-second probe with six seeds compared three candidates. World-aware controller, Offense / default auto-pick deaths:
  - ×1.16 after wave 2 + 7%/wave: 0/6 / 1/6.
  - ×1.20 after wave 1 + 9%/wave (chosen): 3/6 at 348–356 s / 6/6 at 133–343 s, five of them within 133–184 s.
  - ×1.24 after wave 1 + 11%/wave: 6/6 at 243–349 s / 6/6 at 127–159 s, rejected as leaving no room for strong players.
- Human-like real-time play on 3.8.6 died at 143, 159 and 144 seconds; enemy counts rose from about 20 to 70–80 after 110 seconds.
- The no-Dash regression now guards onboarding: every case clears the 25-second first wave and at least three of six reach 45 seconds (observed 42–126 seconds).
- Required-Chrome suite: 54 passed, 0 failed, 0 skipped.

## Harshest tested set — v3.8.7

- Owner feedback after playing 3.8.6: still too easy; use the harshest tested set.
- `DIRECTOR_CONFIG` now uses ×1.24 health per wave after wave 1 and +11% enemy damage per wave (wave 8: health ≈ 9.5×, damage 1.77×). This is the 3.8.6 probe's candidate L. On six seeds, the world-aware Offense controller died at 243–349 seconds in 6/6 runs, and the default auto-pick controller died at 127–159 seconds in 6/6 runs. The no-Dash suite samples died at 41–136 seconds; none died inside the first wave.
- Local suite: 51–52 of 54 passed. Every failure was a DevTools command timeout while load averaged about 175 from an unrelated ffmpeg job; there were no assertion failures. Orphaned headless test browsers from earlier interrupted probes were also killed. The CI `verify` job, on a clean runner, gates deployment.
- The first CI run of 3.8.7 failed in one test. Its unattended real-time page could already be dead before the keyboard-dash check on the harder tuning. The fixture now restarts a finished run before that check. Deployment stayed on 3.8.6 until `verify` passed.

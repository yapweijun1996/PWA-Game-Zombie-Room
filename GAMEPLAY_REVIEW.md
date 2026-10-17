# Gameplay and Codebase Review — 2026-10-17

Review request: “Review the game level, end user complaint too easy, review codebase, output all bugs and update the .md”.

Reviewed baseline: commit `ce22076`, app **3.8.3**. This is a review and documentation update; game code, tuning, tests, releases, and stored scores were not changed. Source locations below refer to this baseline.

## Result

The complaint is supported by repeatable low-pressure runs, but difficulty is inconsistent across seeds and room geometry. All nine existing world-aware synthetic runs reached five minutes at full HP/shield again. A simpler controller, with no Dash or enemy awareness, also finished three of six trials at full HP/shield; the other three died before 132 seconds. Increasing every enemy's health or count would risk making the difficult openings worse while preserving the easy late-game loop.

This review found **11 confirmed defects**, **six balance/UX concerns**, and gaps in difficulty acceptance. These are all confirmed findings from the reviewed code and scenarios, not a guarantee that no other defects exist. Functional regression checks pass despite these uncovered cases.

## Confirmed defect register

P1 means high-impact gameplay or release correctness; P2 means a functional defect; P3 means a lower-impact presentation or feedback defect. Every item below remains **open**.

| ID | Priority | Finding | Source |
| --- | --- | --- | --- |
| F01 | P1 | Enemies can remain permanently pinned behind cover | `src/entities.js:449–479,1200–1271` |
| F02 | P1 | Service-worker updates can mix HTML and modules from different versions | `service-worker.js:67–92` |
| F03 | P2 | Player bullets can cross cover or damage a target before cover intercepts them | `src/entities.js:1093–1176` |
| F04 | P2 | Queued level-up rewards are lost when upgrade choices run out | `src/entities.js:640–648,697–706` |
| F05 | P2 | Simulation continues mutating results after lethal hazard damage | `src/entities.js:1332–1377` |
| F06 | P2 | Guaranteed blackout supplies disappear at the pickup cap | `src/entities.js:378–397,999–1008` |
| F07 | P2 | Short desktop viewports permit offscreen player movement | `src/main.js:19–20,33–37` |
| F08 | P2 | Enabling automatic selection inside an already-open upgrade dialog does nothing | `src/game-ui.js:78–99` |
| F09 | P2 | Movement shortcuts consume keyboard input intended for Settings controls | `src/input.js:53–64` |
| F10 | P3 | Share Run claims a successful copy when the Clipboard API is unavailable | `src/main.js:231–240` |
| F11 | P3 | Maximum-level build chips expose an untranslated internal key | `src/game-ui.js:300`, `src/i18n.js:1305–1315` |

### F01 — Enemy pursuit deadlocks against pillars

Enemies always move directly toward the player, then obstacle resolution pushes them out of the pillar. There is no route selection or recovery when forward movement is blocked. This converts strategic cover into an indefinite safe barrier for aligned enemies, including Bosses, and can suppress later encounters through the active-Boss pacing rules described in B04.

- **Reproduce:** place a pillar at `(200,200,46,40)`, a stationary player at `(300,220)`, and a walker at `(180,220)` with radius 13 and speed 50. Disable firing, hazards, and new spawns. Advance 600 steps of `1/60` second. The walker remains at **`(187,220)`**, with the player at full HP/shield. A corresponding Boss fixture also remained blocked for ten seconds.
- **Expected:** an enemy blocked by cover should eventually navigate around it or use an explicitly designed alternate attack.
- **Suggested fix:** add bounded obstacle-aware steering or routing, with a stuck-state escape. Keep pillars solid and preserve charge telegraphs.
- **Acceptance:** repeat on all four pillar faces, at corners, and with walkers, runners, tanks, and Bosses. Verify that movement resolves the obstruction without teleporting, crossing solid cover, or creating an unavoidable attack.

### F02 — PWA cache versions are not coherent

Navigation returns network HTML immediately while scripts are served from cache. Background revalidation writes newly deployed modules into the active worker's old version cache individually. Retaining the install-time `index.html` does not prevent module mixing. The historical v3.8.2 note in `progress.md` describes the earlier fix's intent, not a complete guarantee of version coherence.

- **Reproduce:** execute the unchanged service worker with an old active cache and a newly deployed server. Navigation returns **new HTML**, while the first `main.js` fetch returns **old main**. After revalidation, the old cache can contain **old index / new main / old entities**. This was confirmed using an isolated Node VM with controlled fetch/cache responses; a real two-release browser deployment was not performed.
- **Impact:** an incompatible update can break the current game or a later offline startup before the player accepts Update.
- **Suggested fix:** keep shell assets immutable within a release cache and make navigation, dependency loading, and waiting-worker activation use a coherent release. Preserve the explicit update flow.
- **Acceptance:** install release A, publish incompatible release B in an isolated fixture, decline Update, reload online and offline, then accept Update. Each session must use a complete A or complete B asset set, including subsequent requests from already-open tabs.

### F03 — Player bullet collision is neither swept nor ordered by impact

Unlike enemy projectile collision in `ranged-combat.js`, player bullets only test their new position. Enemy collision runs before obstacle collision; pillar tests also omit bullet radius.

- **Corner crossing:** pillar `(180,210,46,40)`; bullet starts `(176,211)`, velocity `(460,-100)`, radius 3.5, `dt=0.034`. The segment crosses the corner but the bullet survives at **`(191.64,207.6)`**.
- **Wrong impact order:** same pillar; static enemy at `(239,220)`, radius 13, HP 100; bullet starts `(224,205)`, velocity `(0,460)`, radius 3.5, `dt=0.034`. The pillar is encountered first, but enemy HP becomes **99** before the bullet is removed.
- **Suggested fix:** use radius-aware swept intersections for both cover and enemies, resolving the earliest contact. Continue piercing only through permitted enemy hits.
- **Acceptance:** cover before enemy, enemy before cover, grazing corners, narrow target crossings, piercing, and multiple frame intervals must produce consistent results. Keep enemy-projectile regressions passing.

### F04 — Exhausted upgrade queues underpay earned rewards

When the last available choice is consumed, the code awards one `+50 HP` fallback and sets every remaining pending upgrade to zero. The no-choice entry branch similarly consumes one pending upgrade without draining the rest.

- **Reproduce:** complete Arc/Fork/Tesla and all ordinary upgrades except Magnet at level 2. Set HP to `1/225` and queue three earned upgrades. Select the final Magnet card. Result: **51 HP, zero pending upgrades**. The two remaining fallback rewards should give **101 HP**.
- **Suggested fix:** consume each earned upgrade exactly once, including consecutive fallback rewards, with the normal maximum-HP clamp.
- **Acceptance:** test zero, one, and multiple remaining choices; several queued levels from Super Magnet; and a queue that starts with every choice already exhausted. No reward may disappear or repeat.

### F05 — Lethal hazards do not stop the current simulation step

Enemy and projectile damage paths return when the player dies. The hazard path does not, so later hazards can kill enemies, grant rewards, and alter the score after the defeat screen, best score, and playtest outcome are finalized.

- **Reproduce:** player HP 1/shield 0; one active hazard overlaps the player; a second active hazard overlaps a static enemy at HP 1. Both have `tickTimer=0`. After one `1/60` step, defeat shows **score 0 / kills 0**, but game state contains **score 10.0187 / kills 1** and the enemy has disappeared.
- **Suggested fix:** end simulation processing immediately after lethal hazard damage, using the same finalization boundary as other death sources.
- **Acceptance:** visible results, shared summary, best score, and final telemetry must agree and remain frozen after lethal damage, including multiple hazards in the same frame.

### F06 — Guaranteed blackout rewards are silently dropped

The two blackout reward calls use the ordinary eight-pickup cap. This contradicts the advertised guaranteed dual-drop supply cache.

- **Reproduce:** end a blackout with zero, seven, and eight active pickups positioned away from the player. Observed new cache rewards: **2, 1, and 0**, respectively.
- **Suggested fix:** reserve or replace pickup slots for guaranteed rewards under an explicit bounded policy. Apply a consistent policy to Boss rewards as well.
- **Acceptance:** ending a blackout with pools of 0, 7, or 8 must create two identifiable cache rewards without unbounded pool growth.

### F07 — A minimum simulated height creates invisible play space

`viewport.H` is clamped to at least 420 even when the actual window is shorter. In desktop mode the room is sized from this synthetic height, so its lower area can be outside the screen.

- **Reproduce:** Chrome, fine pointer, `1280×320`. Simulation/canvas height is **420**, room bottom **402**. Hold Down for two simulation seconds: player center is **y=389**, radius 13, entirely below the visible 320-pixel window.
- **Suggested fix:** derive the playable bounds from the visible viewport and available HUD/control area, with a deliberate compact layout for short windows.
- **Acceptance:** the full player circle and necessary controls remain visible at `1280×320`, `844×390`, and the supported mobile portrait/landscape sizes after movement, resize, and Dash.

### F08 — Off-to-on automatic selection loses its chooser

`startAutoUpgradeCountdown()` returns while automatic selection is disabled before saving `onChoose`. Turning it on in the current dialog then finds no chooser and cannot start the timer.

- **Reproduce:** disable automatic selection; open an earned upgrade; enable its checkbox; wait 3.5 visible seconds. The dialog remains open, the progress indicator stays hidden, and no choice is applied.
- **Suggested fix:** retain the current dialog's chooser independently of whether its timer is enabled.
- **Acceptance:** off→on, on→off→on, queued dialogs, background/foreground, and manual selection all apply at most one choice at the correct time.

### F09 — Settings does not own its movement-key input

The global key handler prevents default behavior for WASD/arrow keys without checking the event target or Settings ownership.

- **Reproduce:** open Settings, focus `#languageSelect`, and press ArrowDown. The event is **default-prevented** and `input.down` becomes **true** while focus remains on the select. Native keyboard language selection is blocked.
- **Suggested fix:** respect interactive controls and modal ownership; still clear gameplay key state when keys are released or focus changes.
- **Acceptance:** all seven languages can be selected by keyboard. Navigating Settings must not move the character or leave a movement key active after closing it.

### F10 — Share Run has false-success and silent-failure branches

The missing-API branch displays “RUN SUMMARY COPIED!” without copying. A rejected `writeText()` is silently ignored.

- **Reproduce:** make `navigator.clipboard` unavailable in an isolated browser fixture and click Share Run. A success message appears with no clipboard operation. Inspecting the rejection branch also confirms that it has no error feedback.
- **Suggested fix:** announce success only after a successful copy; offer a selectable summary or clear failure feedback when copying is unavailable or denied.
- **Acceptance:** available/success, unavailable, and rejected clipboard cases each give truthful feedback and a usable next action.

### F11 — Defeat build summary leaks a missing translation key

Maximum ordinary upgrade chips request `t('upgradeMaxLevel')`, but this key is absent from every locale and the English fallback.

- **Reproduce:** die with any maximum-level ordinary upgrade. The chip displays **`UPGRADEMAXLEVEL`**. Calling `t('upgradeMaxLevel')` returns the raw key in **en, zh, ms, ja, ko, vi, and th**. Confirmed in the mobile defeat screenshot and dictionary checks.
- **Suggested fix:** use the existing appropriate maximum-level label or add the required label to all seven dictionaries.
- **Acceptance:** maximum-level chips show a translated label in every locale; no rendered summary contains an internal key.

## Balance and UX concerns — separate from defects

These behaviors follow current constants or policies. They explain the complaint and merit measured tuning, but the review does not treat their exact values as coding errors.

### B01 — Player damage grows faster than encounter durability

`src/entities.js:519–608` permits ordinary damage **3.71293**, firing interval **0.140881 seconds**, three projectiles, three direct-hit targets per piercing bullet, and 60% critical chance, before exclusive builds, combo bonuses, or Overdrive. The starting damage/interval are 1/0.38 seconds.

By comparison, `wave-director.js:72–74` and `entities.js:290–293,490–495` give the following unarmored HP:

| Wave / scheduled time | Walker | Boss |
| --- | --- | --- |
| 8 / 175 seconds | 3.801 | 44.6 |
| 12 / 275 seconds | 4.998 | 60.8 |

Arc chains, Scatter displacement, critical hits, and pickups amplify an already strong ordinary progression. Actual DPS depends on aim, cover, and hit geometry; these figures are capability comparisons, not measured hit rates. Measure time-to-kill, Boss lifetime, upgrade timing, and live enemy count before changing health multipliers.

### B02 — Boss charges are slower than normal player movement

Player speed starts at **180 px/s**, reaches **300** through Agility, and can receive a ×1.25 combo bonus (`entities.js:31,583,1040`). Boss frenzy dash speed is only **111.72** at wave 8 and **127.68** at wave 12 (`:496,1225`). Ordinary enemy movement is capped at 160 (`wave-director.js:7`).

At these stages, the telegraphed Boss charge cannot close distance against straight-line base movement in open space. Room edges, interception, Frost, and other enemies can still cause damage. Evaluate closing speed and attack coverage while retaining readable warnings and mobile counterplay.

### B03 — Base spawn escalation saturates before three minutes

`getSpawnInterval()` reaches its **0.22-second floor at approximately 129.48 seconds**, in wave 6. Time and wave increases no longer raise base spawn frequency after that point. Phase multipliers still lower the effective rate during blackout and Boss waves; recovery and relief reduce it further.

The floor is a deliberate safety bound, not a defect. Assess composition, coordinated attack opportunities, and meaningful stage changes within the existing entity/performance caps instead of relying entirely on a faster spawn timer.

### B04 — Keeping a Boss alive suppresses other threats

`wave-director.js:159–173` limits ordinary spawn rate to at most 0.42 during an active Boss, prevents new spitters, and discards later Boss/blackout events. Together with slow charges and F01, kiting or trapping a Boss can turn later pressure waves into reduced-rate melee encounters.

Simply increasing Boss HP could prolong this condition. Measure pressure during living-Boss carryover separately from Boss-death recovery before changing either durability or spawn policy. Existing spitters can still attack; the policy suppresses new ones.

### B05 — Growth and recovery erase attrition

The current complete build requires 32 earned selections: 29 ordinary purchases plus path, specialization, and evolution. Reaching level 33 costs **1,414 cumulative XP** under `entities.js:720–728`, although choices and collection timing determine when it happens. After choices are exhausted, level-ups heal 50; Vitality also increases maximum HP and heals during growth.

Maximum HP is 225; the 40-point shield regenerates at 16 points per second after four seconds without damage (`:988–992`). Contact damage remains 8/11/17/24 for runner/walker/tank/Boss (`:291–293,497`). Environmental damage, medkits, nukes, and combo bonuses add more safety or free kills. Compare net HP loss, healing received, shield downtime, and pickup use across builds rather than balancing from final HP alone.

### B06 — Automatic aim repeatedly selects an obstructed target

`entities.js:319–328` selects the nearest enemy without testing whether it is attackable. With player `(150,230)`, pillar `(180,210,46,40)`, a covered enemy `(239,230)`, and a clear enemy `(150,350)`, ten seconds of ordinary auto-fire damages neither enemy. Both enemies were static in this fixture.

Nearest-target selection may be an intentional movement puzzle, so this is a confirmed UX limitation rather than a contract violation. If automatic targeting is meant to choose a useful target, prefer a visible enemy and provide a deliberate fallback when all targets are covered. Recheck all build paths, whose attacks have different ranges and effects.

## Verification performed

### Existing regression suite

```bash
PLAYTEST_BROWSER='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PLAYTEST_REQUIRE_BROWSER=1 node --test tests/*.test.mjs
```

Result on the reviewed source: **41 passed, 0 failed, 0 skipped**, approximately 56.5 seconds, Node 23.10.0 / local Chrome 155. This covers the existing pure rules, browser integrations, replay, build choices, mobile interactions, and offline startup. No production code or tests were changed to obtain this result.

Controlled defect probes deliberately produced the failures described in F01–F11. Passing the existing suite therefore does not clear these findings. Browser fixture runs reported no uncaught runtime exceptions; the inspected local page's document/modules returned HTTP 200 with no console warnings/errors at inspection.

### Existing world-aware synthetic controller

Re-ran `tests/director.browser.test.mjs` across seeds 42, 160501, and 202602 and its three policies:

| Policy / resulting path | Survived to 300s | Final HP / shield | Damage events | Spitter shots |
| --- | --- | --- | --- | --- |
| Offense / Scatter | 3 / 3 | 225 / 40 in every run | 1 in every run | 5–15 |
| First card / Arc | 3 / 3 | 225 / 40 in every run | 4–9 | 10–22 |
| Mobility / Mobile Striker | 3 / 3 | 225 / 40 in every run | 6–13 | 12–16 |

Kills ranged from 726 to 747. This controller reads enemy/hazard/orb positions, selects safe movement directions, collects XP, and uses Dash. It demonstrates a survivable strategy, not representative human difficulty.

### Simpler controller, without enemy awareness or Dash

Used the existing isolated browser harness with a fresh page for each seed, a fixed 1/60-second simulation step, and first-card selection immediately on every upgrade. Move **Right, Down, Left, Up**, changing direction every one simulation second; evaluate movement in 100ms batches. No enemy positions are read to decide movement; no Dash, stat injection, or enemy removal is used. Touch emulation is enabled for the phone viewport; movement is synthetic keyboard state in both viewports, not physical touch.

| Viewport | Seed | Outcome / seconds | Final HP / shield | Level | Kills |
| --- | --- | --- | --- | --- | --- |
| 1200×685 | 42 | Alive at 300.05 | 225 / 40 | 34 | 744 |
| 1200×685 | 160501 | Death at 131.45 | 0 / 0 | 11 | 150 |
| 1200×685 | 202602 | Alive at 300.00 | 225 / 40 | 33 | 719 |
| 390×844 | 42 | Death at 82.25 | 0 / 0 | 8 | 89 |
| 390×844 | 160501 | Death at 117.02 | 0 / 0 | 10 | 118 |
| 390×844 | 202602 | Alive at 300.02 | 225 / 40 | 32 | 744 |

An independent repeat in the same harness reproduced all six rows. Recording stops at 300 seconds, but a final 100ms advance can continue gameplay slightly beyond it. A stationary desktop seed-42 control died at 135.77 seconds, level 12, 183 kills; staying still is not universally safe.

**Geometry limitation:** a separate headed Chrome DevTools run at nominally 390×844 with seed 202602 died at 112.23 seconds. Its measured room started at y=82.5 with height 627.5; the headless harness room started at y=74.25 with height 635.75. The room is derived from rendered HUD geometry, so seed and nominal viewport alone do not specify identical physics across browser/layout environments. Preserve the browser mode, room dimensions, settings, and action policy when comparing tuning experiments. This difference remains a validation limit, not proof of a new root-cause defect.

### Difficulty acceptance gaps

- `tests/director.browser.test.mjs:169–174` accepts both death and time-cap outcomes. It verifies safe execution/replay, not whether familiar players feel pressure after 3–5 minutes. Do not turn a synthetic full-health run into a passing difficulty claim.
- The current policies omit representative physical touch behavior, mistakes, reaction delays, and upgrade decision time. Instant card selection also omits real-time automatic-selection waiting, although simulation is paused during the dialog.
- The controlled 10/20-minute fixtures grant invulnerability; they verify bounds and simulation safety, not survival difficulty.
- Real iOS/Android devices, a real incompatible-release update cycle, translation fluency, and human enjoyment were not validated by this review.
- Retain the existing human gate: at least five familiar players, with at least three reporting a clear pressure increase around minutes 3–5, understanding the main damage/counterplay, and wanting another run. Define the desired survival curve with those results before choosing numerical difficulty targets.

## Recommended implementation order

1. Fix F01/F03 so cover and enemy movement behave predictably, and F02 so update behavior is coherent. Re-run their exact failure cases before tuning difficulty.
2. Fix F04–F11 with focused regression cases. Keep existing input, pause, replay, offline, and build tests passing.
3. Establish a balance baseline across identical room geometry, seeds, all three paths, first-card selection, and simple/human movement. Track Boss lifetime, first HP damage, time-to-kill, upgrade timing, healing, shield downtime, and ranged-attack exposure.
4. Tune B01–B05 together against the agreed pressure/survival targets; preserve caps, readable telegraphs, and mobile escape opportunities. Decide B06's intended targeting policy explicitly.
5. Run familiar-player sessions and physical-device checks, then record whether the original complaint is resolved. No difficulty fix or release is claimed by this documentation review.

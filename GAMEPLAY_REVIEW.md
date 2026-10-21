# Gameplay and Codebase Review — 2026-10-17

Review request: “Review the game level, end user complaint too easy, review codebase, output all bugs and update the .md”.

Reviewed baseline: commit `ce22076`, app **3.8.3**. The findings below refer to that reviewed baseline; their fixes and follow-up evidence are recorded against app **3.8.4**.

## Result

The complaint was supported by repeatable low-pressure runs, with outcomes varying by seed and room geometry. After the fixes and tuning, the world-aware synthetic controller survived eight of nine five-minute runs; the first-card/no-Dash square-movement controller survived one of six, while five died between 44 and 178 seconds. These controlled results show more damage exposure and greater risk, but they do not establish the intended 3–5-minute pressure for familiar players.

The review found **11 confirmed defects** and **six balance/UX concerns**. All 11 defects now have fixes and targeted regression coverage. The balance changes address the six concerns, while human acceptance, physical-device play, and a real two-release PWA update cycle remain unverified.

## Confirmed defect register

P1 means high-impact gameplay or release correctness; P2 means a functional defect; P3 means a lower-impact presentation or feedback defect. All listed findings are **fixed in app 3.8.4**.

| ID | Priority | Finding | Source | Status |
| --- | --- | --- | --- | --- |
| F01 | P1 | Enemies can remain permanently pinned behind cover | `src/entities.js:449–479,1200–1271` | Fixed; routing tests pass |
| F02 | P1 | Service-worker updates can mix HTML and modules from different versions | `service-worker.js:67–92` | Fixed; cache and offline tests pass |
| F03 | P2 | Player bullets can cross cover or damage a target before cover intercepts them | `src/entities.js:1093–1176` | Fixed; swept-impact tests pass |
| F04 | P2 | Queued level-up rewards are lost when upgrade choices run out | `src/entities.js:640–648,697–706` | Fixed; queued/exhausted cases pass |
| F05 | P2 | Simulation continues mutating results after lethal hazard damage | `src/entities.js:1332–1377` | Fixed; lethal-step browser test passes |
| F06 | P2 | Guaranteed blackout supplies disappear at the pickup cap | `src/entities.js:378–397,999–1008` | Fixed; 0/7/8 pickup cases pass |
| F07 | P2 | Short desktop viewports permit offscreen player movement | `src/main.js:19–20,33–37` | Fixed; 1280×320 browser test passes |
| F08 | P2 | Enabling automatic selection inside an already-open upgrade dialog does nothing | `src/game-ui.js:78–99` | Fixed; off→on timer test passes |
| F09 | P2 | Movement shortcuts consume keyboard input intended for Settings controls | `src/input.js:53–64` | Fixed; focused-control test passes |
| F10 | P3 | Share Run claims a successful copy when the Clipboard API is unavailable | `src/main.js:231–240` | Fixed; unavailable/rejected cases pass |
| F11 | P3 | Maximum-level build chips expose an untranslated internal key | `src/game-ui.js:300`, `src/i18n.js:1305–1315` | Fixed; all seven locales pass |

### F01 — Enemy pursuit deadlocks against pillars

Enemies always move directly toward the player, then obstacle resolution pushes them out of the pillar. There is no route selection or recovery when forward movement is blocked. This converts strategic cover into an indefinite safe barrier for aligned enemies, including Bosses, and can suppress later encounters through the active-Boss pacing rules described in B04.

- **Reproduce:** place a pillar at `(200,200,46,40)`, a stationary player at `(300,220)`, and a walker at `(180,220)` with radius 13 and speed 50. Disable firing, hazards, and new spawns. Advance 600 steps of `1/60` second. The walker remains at **`(187,220)`**, with the player at full HP/shield. A corresponding Boss fixture also remained blocked for ten seconds.
- **Expected:** an enemy blocked by cover should eventually navigate around it or use an explicitly designed alternate attack.
- **Suggested fix:** add bounded obstacle-aware steering or routing, with a stuck-state escape. Keep pillars solid and preserve charge telegraphs.
- **Resolution (3.8.4):** added visibility-graph waypoints around radius-expanded obstacles for pursuit; active Boss/swift charge telegraphs keep their locked direction. Regression coverage exercises direct pursuit, a centerline pillar deadlock, multiple obstacles, and a live walker route. All four faces and every enemy type still need broader movement coverage.

### F02 — PWA cache versions are not coherent

Navigation returns network HTML immediately while scripts are served from cache. Background revalidation writes newly deployed modules into the active worker's old version cache individually. Retaining the install-time `index.html` does not prevent module mixing. The historical v3.8.2 note in `progress.md` describes the earlier fix's intent, not a complete guarantee of version coherence.

- **Reproduce:** execute the unchanged service worker with an old active cache and a newly deployed server. Navigation returns **new HTML**, while the first `main.js` fetch returns **old main**. After revalidation, the old cache can contain **old index / new main / old entities**. This was confirmed using an isolated Node VM with controlled fetch/cache responses; a real two-release browser deployment was not performed.
- **Impact:** an incompatible update can break the current game or a later offline startup before the player accepts Update.
- **Suggested fix:** keep shell assets immutable within a release cache and make navigation, dependency loading, and waiting-worker activation use a coherent release. Preserve the explicit update flow.
- **Resolution (3.8.4):** controlled navigation and module requests now use the installed release cache first; uncached requests are fetched without mutating that release. Bumped the worker/app shell to 3.8.4 and precached the navigation module. The Node VM regression simulates stale release A against release B responses, and the browser offline-start test passes. A deployed two-release accept/decline cycle remains untested.

### F03 — Player bullet collision is neither swept nor ordered by impact

Unlike enemy projectile collision in `ranged-combat.js`, player bullets only test their new position. Enemy collision runs before obstacle collision; pillar tests also omit bullet radius.

- **Corner crossing:** pillar `(180,210,46,40)`; bullet starts `(176,211)`, velocity `(460,-100)`, radius 3.5, `dt=0.034`. The segment crosses the corner but the bullet survives at **`(191.64,207.6)`**.
- **Wrong impact order:** same pillar; static enemy at `(239,220)`, radius 13, HP 100; bullet starts `(224,205)`, velocity `(0,460)`, radius 3.5, `dt=0.034`. The pillar is encountered first, but enemy HP becomes **99** before the bullet is removed.
- **Suggested fix:** use radius-aware swept intersections for both cover and enemies, resolving the earliest contact. Continue piercing only through permitted enemy hits.
- **Resolution (3.8.4):** added radius-aware swept traces, sorted target impacts by travel time, made cover win when encountered first, and made auto-aim prefer targets with clear line of sight. Piercing continues through ordered visible hits; chain arcs also respect cover. Unit and browser regressions cover targets before/behind cover and piercing order; existing enemy-shot tests pass.

### F04 — Exhausted upgrade queues underpay earned rewards

When the last available choice is consumed, the code awards one `+50 HP` fallback and sets every remaining pending upgrade to zero. The no-choice entry branch similarly consumes one pending upgrade without draining the rest.

- **Reproduce:** complete Arc/Fork/Tesla and all ordinary upgrades except Magnet at level 2. Set HP to `1/225` and queue three earned upgrades. Select the final Magnet card. Result: **51 HP, zero pending upgrades**. The two remaining fallback rewards should give **101 HP**.
- **Suggested fix:** consume each earned upgrade exactly once, including consecutive fallback rewards, with the normal maximum-HP clamp.
- **Resolution (3.8.4):** each unavailable queued level now restores 25 HP, clamps at max HP, and drains the entire queue. Browser regressions cover a final available choice followed by two fallback levels and a queue that starts exhausted.

### F05 — Lethal hazards do not stop the current simulation step

Enemy and projectile damage paths return when the player dies. The hazard path does not, so later hazards can kill enemies, grant rewards, and alter the score after the defeat screen, best score, and playtest outcome are finalized.

- **Reproduce:** player HP 1/shield 0; one active hazard overlaps the player; a second active hazard overlaps a static enemy at HP 1. Both have `tickTimer=0`. After one `1/60` step, defeat shows **score 0 / kills 0**, but game state contains **score 10.0187 / kills 1** and the enemy has disappeared.
- **Suggested fix:** end simulation processing immediately after lethal hazard damage, using the same finalization boundary as other death sources.
- **Resolution (3.8.4):** the update returns as soon as hazard damage ends the run, before later hazards or score/checkpoint mutation. Browser regression confirms the next hazard and score remain untouched after death.

### F06 — Guaranteed blackout rewards are silently dropped

The two blackout reward calls use the ordinary eight-pickup cap. This contradicts the advertised guaranteed dual-drop supply cache.

- **Reproduce:** end a blackout with zero, seven, and eight active pickups positioned away from the player. Observed new cache rewards: **2, 1, and 0**, respectively.
- **Suggested fix:** reserve or replace pickup slots for guaranteed rewards under an explicit bounded policy. Apply a consistent policy to Boss rewards as well.
- **Resolution (3.8.4):** blackout bundles reserve two slots by evicting pickups nearest expiry; single Boss supplies also displace one expiring pickup at capacity. The pool stays capped at eight and browser regressions confirm two new cache rewards with initial pools of 0, 7, and 8.

### F07 — A minimum simulated height creates invisible play space

`viewport.H` is clamped to at least 420 even when the actual window is shorter. In desktop mode the room is sized from this synthetic height, so its lower area can be outside the screen.

- **Reproduce:** Chrome, fine pointer, `1280×320`. Simulation/canvas height is **420**, room bottom **402**. Hold Down for two simulation seconds: player center is **y=389**, radius 13, entirely below the visible 320-pixel window.
- **Suggested fix:** derive the playable bounds from the visible viewport and available HUD/control area, with a deliberate compact layout for short windows.
- **Resolution (3.8.4):** canvas height now follows the actual viewport, and room bounds use a compact minimum that fits short windows. Browser regression resizes to `1280×320` and checks the room and full player circle remain on-screen. Physical devices and every short mobile layout remain to be checked.

### F08 — Off-to-on automatic selection loses its chooser

`startAutoUpgradeCountdown()` returns while automatic selection is disabled before saving `onChoose`. Turning it on in the current dialog then finds no chooser and cannot start the timer.

- **Reproduce:** disable automatic selection; open an earned upgrade; enable its checkbox; wait 3.5 visible seconds. The dialog remains open, the progress indicator stays hidden, and no choice is applied.
- **Suggested fix:** retain the current dialog's chooser independently of whether its timer is enabled.
- **Resolution (3.8.4):** the dialog now retains its chooser even while auto-pick is off, allowing the existing setting-change handler to start the timer when enabled. Browser regression opens with the option off, enables it in-place, and observes exactly one recorded choice.

### F09 — Settings does not own its movement-key input

The global key handler prevents default behavior for WASD/arrow keys without checking the event target or Settings ownership.

- **Reproduce:** open Settings, focus `#languageSelect`, and press ArrowDown. The event is **default-prevented** and `input.down` becomes **true** while focus remains on the select. Native keyboard language selection is blocked.
- **Suggested fix:** respect interactive controls and modal ownership; still clear gameplay key state when keys are released or focus changes.
- **Resolution (3.8.4):** movement keydown now yields to focused text/select controls and open Settings; keyup still clears a movement key that was pressed before focus changed. Browser regression checks a focused language selector does not prevent ArrowDown or set movement input.

### F10 — Share Run has false-success and silent-failure branches

The missing-API branch displays “RUN SUMMARY COPIED!” without copying. A rejected `writeText()` is silently ignored.

- **Reproduce:** make `navigator.clipboard` unavailable in an isolated browser fixture and click Share Run. A success message appears with no clipboard operation. Inspecting the rejection branch also confirms that it has no error feedback.
- **Suggested fix:** announce success only after a successful copy; offer a selectable summary or clear failure feedback when copying is unavailable or denied.
- **Resolution (3.8.4):** success appears only after `writeText()` resolves; missing or rejected clipboard access shows a translated failure message in each supported locale. Browser regression exercises both failure paths. A selectable manual-copy fallback is not included.

### F11 — Defeat build summary leaks a missing translation key

Maximum ordinary upgrade chips request `t('upgradeMaxLevel')`, but this key is absent from every locale and the English fallback.

- **Reproduce:** die with any maximum-level ordinary upgrade. The chip displays **`UPGRADEMAXLEVEL`**. Calling `t('upgradeMaxLevel')` returns the raw key in **en, zh, ms, ja, ko, vi, and th**. Confirmed in the mobile defeat screenshot and dictionary checks.
- **Suggested fix:** use the existing appropriate maximum-level label or add the required label to all seven dictionaries.
- **Resolution (3.8.4):** added a localized maximum-level label to all seven dictionaries. Browser regression checks the rendered English chip and verifies both new labels resolve in every locale.

## Balance and UX concerns — separate from defects

These behaviors follow current constants or policies. They explain the complaint and merit measured tuning, but the review does not treat their exact values as coding errors.

### B01 — Player damage grows faster than encounter durability

`src/entities.js:519–608` permits ordinary damage **3.71293**, firing interval **0.140881 seconds**, three projectiles, three direct-hit targets per piercing bullet, and 60% critical chance, before exclusive builds, combo bonuses, or Overdrive. The starting damage/interval are 1/0.38 seconds.

In 3.8.4, enemy progression is stronger while the player upgrade multipliers stay unchanged. `wave-director.js` and `entities.js` now produce:

| Wave / scheduled time | Walker | Boss |
| --- | --- | --- |
| 8 / 175 seconds | 4.347 | 52.6 |
| 12 / 275 seconds | 5.901 | 73.8 |

Arc chains, Scatter displacement, critical hits, and pickups still amplify progression. Actual DPS depends on aim, cover, and hit geometry; these figures are capability comparisons, not measured hit rates. The 3.8.4 five-minute trials recorded more damage events and spitter shots, while real-player time-to-kill and Boss lifetime remain unknown.

### B02 — Boss charges are slower than normal player movement

Player speed starts at **180 px/s**, reaches **300** through Agility, and can receive a ×1.25 combo bonus. Boss speed is now `40 + 2.2 × wave`; its normal/frenzy charge factors are 2.45/2.9, with a ×1.42 frenzy movement scale. At waves 8 and 12, the frenzy dash speeds are about **237** and **273 px/s**, respectively. Ordinary enemy movement is capped at 180.

The faster telegraphed charge can now catch a base-speed player during frenzy while preserving the warning window and escape counterplay. Physical-device readability and experienced-player reaction time remain untested.

### B03 — Base spawn escalation saturates before three minutes

`getSpawnInterval()` now has a **0.18-second floor**, reached at about **138 seconds** in wave 6. The safety floor still caps late base frequency, but allows 22% more spawns at the floor than the former 0.22-second value. The per-wave health curve continues to rise after the floor; recovery and relief remain bounded.

The floor is a deliberate safety bound, not a defect. Assess composition, coordinated attack opportunities, and meaningful stage changes within the existing entity/performance caps instead of relying entirely on a faster spawn timer.

### B04 — Keeping a Boss alive suppresses other threats

The director still discards later Boss/blackout events while a Boss is alive, but the 3.8.4 carryover cap is 0.68 instead of 0.42 and buildup/pressure waves can add spitters within their quota. This increases support spawn frequency while a Boss remains alive; late Boss health and support exposure increased in the fixed-seed runs.

Boss-death recovery is four seconds, while the reduced support spawn interval and restored spitter eligibility apply only during a living-Boss carryover on buildup/pressure waves. The Boss and blackout phase rules remain distinct.

### B05 — Growth and recovery erase attrition

The current complete build requires 32 earned selections: 29 ordinary purchases plus path, specialization, and evolution. Reaching level 33 costs **1,414 cumulative XP**, although choices and collection timing determine when it happens. Exhausted queued levels now heal 25 HP each instead of collapsing to one 50-HP reward; Vitality restores 25 HP per selection instead of 40.

Maximum HP remains 225. The 40-point shield regenerates at 12 points per second after four seconds without damage, and the director's recovery/relief periods are shorter and less frequent. Contact damage remains 8/11/17/24 for runner/walker/tank/Boss. Environmental damage, medkits, nukes, and combo bonuses still add safety or free kills. The new six-run simple-controller sample has one 300-second survivor and five deaths at 44–178 seconds; a human survival curve is still needed.

### B06 — Automatic aim repeatedly selects an obstructed target

In the reviewed baseline, `entities.js:319–328` selected the nearest enemy without testing whether it was attackable. In 3.8.4 auto-aim skips targets whose direct shot intersects cover, then chooses the nearest visible target. Enemies still route around obstacles, and Tesla arcs now obey line of sight.

When all enemies are hidden behind cover, the player waits for a visible route rather than firing through a pillar; no manual aim mode was added. The path-specific attack styles share the same cover ordering, though a broader human check of each build remains useful.

## Verification performed

### Existing regression suite

```bash
PLAYTEST_BROWSER='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PLAYTEST_REQUIRE_BROWSER=1 node --test tests/*.test.mjs
```

At the 3.8.3 review baseline, **41 passed, 0 failed, 0 skipped** in about 56.5 seconds on Node 23.10.0 / local Chrome 155. Those checks did not cover F01–F11.

On the fixed 3.8.4 source, the same Chrome-required command passes **53 tests, 0 failed, 0 skipped**. New unit/browser coverage exercises all 11 findings, director tuning, and cache coherence. Browser regressions reported no uncaught runtime exceptions.

### Baseline world-aware synthetic controller (3.8.3)

The v3.8.3 baseline results from `tests/director.browser.test.mjs` across seeds 42, 160501, and 202602 were:

| Policy / resulting path | Survived to 300s | Final HP / shield | Damage events | Spitter shots |
| --- | --- | --- | --- | --- |
| Offense / Scatter | 3 / 3 | 225 / 40 in every run | 1 in every run | 5–15 |
| First card / Arc | 3 / 3 | 225 / 40 in every run | 4–9 | 10–22 |
| Mobility / Mobile Striker | 3 / 3 | 225 / 40 in every run | 6–13 | 12–16 |

Kills ranged from 726 to 747. This controller reads enemy/hazard/orb positions, selects safe movement directions, collects XP, and uses Dash. It demonstrates a survivable strategy, not representative human difficulty.

### Post-fix synthetic comparisons (3.8.4)

The same world-aware controller and seeds were run after the 3.8.4 changes. Eight of nine runs reached 300 seconds at 225 HP/40 shield; the first-card Arc run on seed 160501 died at 129.38 seconds. Surviving runs recorded 1–20 damage events and 8–23 spitter shots, compared with the lower exposure in the baseline samples above.

| Policy / resulting path | Survived to 300s | Damage events | Spitter shots |
| --- | --- | --- | --- |
| Offense / Scatter | 3 / 3 | 1–3 | 8–16 |
| First card / Arc | 2 / 3 | 2–19 | 9–22 |
| Mobility / Mobile Striker | 3 / 3 | 10–20 | 18–23 |

The simple first-card/no-Dash loop was repeated with six fixed seed/viewport cases in `tests/gameplay-review-regressions.browser.test.mjs`:

| Viewport | Seed | Outcome / seconds | Final HP / shield |
| --- | --- | --- | --- |
| 1200×685 | 42 | Death at 43.95 | 0 / 0 |
| 1200×685 | 160501 | Alive at 300 | 225 / 40 |
| 1200×685 | 202602 | Death at 123.10 | 0 / 0 |
| 390×844 | 42 | Death at 46.05 | 0 / 0 |
| 390×844 | 160501 | Death at 178.02 | 0 / 0 |
| 390×844 | 202602 | Death at 129.43 | 0 / 0 |

The no-Dash controller is deliberately simple and does not stand in for a human. Together these samples show that skilled movement remains survivable while a controller that never avoids threats or uses Dash is at much greater risk.

### Baseline simple controller, without enemy awareness or Dash (3.8.3)

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

### Remaining difficulty acceptance gaps

- `tests/director.browser.test.mjs:169–174` accepts both death and time-cap outcomes. It verifies safe execution/replay, not whether familiar players feel pressure after 3–5 minutes. Do not turn a synthetic full-health run into a passing difficulty claim.
- The current policies omit representative physical touch behavior, mistakes, reaction delays, and upgrade decision time. Instant card selection also omits real-time automatic-selection waiting, although simulation is paused during the dialog.
- The controlled 10/20-minute fixtures grant invulnerability; they verify bounds and simulation safety, not survival difficulty.
- Real iOS/Android devices, a real incompatible-release update cycle, translation fluency, and human enjoyment were not validated by this review.
- Retain the existing human gate: at least five familiar players, with at least three reporting a clear pressure increase around minutes 3–5, understanding the main damage/counterplay, and wanting another run. Define the desired survival curve with those results before choosing numerical difficulty targets.

## Difficulty tuning — 3.8.5

Follow-up feedback still reported the game as too easy. The 300-second fixtures hid the margin, because every survivor ended at 225 HP / 40 shield. A scratch probe therefore ran each case to **600 seconds**:
- **Seeds:** 42, 160501, 202602, 7, 31337 and 90210.
- **World-aware controller:** Offense and First-card upgrade policies at 390×844.
- **No-Dash square-movement controller:** 1200×685 and 390×844.
- **Recorded:** effective HP (HP + shield), plus the average number of live enemies in each 30-second window.

**Finding (B01, quantified).** On 3.8.4 the world-aware controller stayed above 80% effective HP in 11 of 12 runs over the full 600 seconds. Average live enemies stayed at 5–12, while the cap is 90. Upgrades multiply player damage; enemy health grew only linearly, so most spawns died before reaching the player.

**Change.** Normal and Boss health now compound by ×1.16 per wave after wave 2 (`DIRECTOR_CONFIG.lateHealthGrowth`, `lateGrowthAfterWave`). For example, wave 8 health is 2.07 × 1.16⁶ ≈ 5.04 and wave 12 is ≈ 12.4. Waves 1–2 are unchanged.

Alternatives tried on the same batch:
- ×1.06 after wave 4: little change.
- ×1.12 and ×1.18 after wave 4: pressure only after about 450 seconds.
- ×1.20 after wave 2: First-card deaths at 129–151 seconds.

| Policy (600s probe) | 3.8.4 deaths / times (s) | 3.8.5 deaths / times (s) |
| --- | --- | --- |
| World-aware Offense | 0/6, all 600+ | 4/6 — 446, 451, 460, 483; two 600+ |
| World-aware First-card | 1/6 — 129 | 6/6 — 141, 433, 436, 457, 480, 488 |
| No-Dash 1200×685 | 4/6 — 44, 50, 120, 123 | 6/6 — 44, 50, 124, 139, 145, 171 |
| No-Dash 390×844 | 5/6 — 45, 46, 119, 129, 178 | 6/6 — 45, 46, 95, 115, 136, 141 |

**Upgrade flow.** Level-ups now take the first choice without opening the dialog by default, so most players will follow the First-card policy. Seeded playtests still show the dialog.

**Limits.** The world-aware controller has perfect information and reacts in 100ms. Its deaths at roughly 7–8 minutes are a stress signal, not a prediction of human survival. The no-Dash controller still dies in about 45 seconds on seed 42, exactly as before; the opening was not made harder. Human enjoyment and pressure at 3–5 minutes still require the playtest gate below.

### Human-like real-time play (3.8.5)

The owner set the target that about three minutes should already feel hard. A scratch end-to-end script played ordinary unseeded sessions in real time with CDP keyboard input. Its policy reacts every 250ms, flees enemies within 170px, and dashes when two enemies are close. Upgrades were left on the default automatic selection.

| Build | Runs | Outcome |
| --- | --- | --- |
| 3.8.4 | 3 | All alive past 230 game-seconds at 125–225 HP |
| 3.8.5 (×1.16 per wave after wave 2) | 3 | Deaths at 113, 124 and 193 seconds |
| Candidate ×1.22 per wave after wave 2 | 3 | Deaths at 112, 118 and 141 seconds |

×1.16 was kept. The faster candidate barely moved this policy's roughly 2-minute wall, while it killed the world-aware auto-pick controller at 122–148 seconds on half the seeds.

The same play also exposed a defect, now fixed: a held or freshly pressed direction key, or a tap at the moment of death, restarted instantly and skipped the defeat screen. Input restarts now wait 1.2 seconds after death and ignore key-repeat.

The survival rank also double-counted kills, so a two-minute death ranked S. Rank now follows the wave reached: B from wave 4, A from wave 8, S from wave 13.

## Difficulty tuning — 3.8.6

The owner played 3.8.5 and still found it too easy.

Two changes:
- **Enemy damage now scales with the wave.** Contact, Boss and spitter-projectile damage rise by 9% per wave (wave 8: ×1.63, wave 12: ×1.99). Until now a walker hit for 11 at every wave, against up to 225 HP plus a shield that regenerates.
- **Health compounds faster and sooner:** ×1.20 per wave after wave 1, instead of ×1.16 after wave 2.

| 360s probe, six seeds | World-aware Offense | World-aware auto-pick (default) |
| --- | --- | --- |
| ×1.16 after wave 2 + 7%/wave | 0/6 deaths | 1/6 — 147 s |
| **×1.20 after wave 1 + 9%/wave (3.8.6)** | 3/6 — 348–356 s | 6/6 — 133, 142, 150, 155, 184, 343 s |
| ×1.24 after wave 1 + 11%/wave | 6/6 — 243–349 s | 6/6 — 127–159 s |

Human-like real-time play on 3.8.6 died at 143, 159 and 144 seconds. In every run the crowd rose from about 20 to 70–80 enemies after 110 seconds.

A no-Dash controller still clears the first wave in every case; observed deaths ranged from 42 to 126 seconds.

These results are still synthetic, and real-player feedback remains the deciding signal.

## Remaining validation

- Recruit at least five familiar players. At least three should report a clear pressure increase around minutes 3–5, understand the main damage/counterplay, and want another run. The synthetic trials cannot establish this acceptance gate.
- Exercise a deployed v3.8.3→3.8.4 service-worker update with players who decline and accept the update, both online and offline.
- Check controls, room geometry, and charge readability on real iOS/Android devices.
- Expand enemy-routing coverage across all enemy types and obstacle approaches, and inspect each build's cover/chain behavior in a headed browser.

# Zombie Room

Zombie Room is an offline-first, canvas-based survival game for desktop and mobile browsers. The player moves in four directions, can trigger a timed evasive dash, and fires automatically. The project is implemented as a dependency-free static web app and installable Progressive Web App (PWA).

## Current Features

- Canvas game loop with automatic targeting and shooting.
- Zero-asset procedural sound effects synthesized via Web Audio API (gunshots, crits, kills, pentatonic XP suction, level-up arpeggios, UI taps) with persisted sound toggle.
- Tactile haptic vibration feedback via the Vibration API with multi-pattern pulses for damage, crits, level-ups, boss spawns, and death, with persisted toggle.
- Dynamic floating combat damage numbers with pop-in scaling, upward drift, alpha fade-out, and distinct gold critical strike callouts.
- 360-degree analog floating virtual joystick for touch devices with dynamic thumb-centering and speed scaling, plus WASD / arrow-key support on desktop.
- Walker, runner, tank, telegraphed ranged spitter, and boss enemy types.
- Cinematic Boss encounters with heavy screen rumble, warning haptics, and a dedicated glowing Boss health bar.
- Boss Phase 2 Frenzy (< 50% HP) with terrifying beast roar audio, flaming red magma visuals, blazing golden eyes, halved dash cooldown, and rapid charges.
- Tactical industrial obstacles and cover pillars providing strategic kiting, line-of-sight protection, and projectile absorption.
- Regenerative Energy Shield system absorbing incoming damage with plasma deflection bubbles, overload break shatter, and auto-recharge delay.
- Dynamic environmental electrical hazard pools with cyclic dormant/warning/active phases, electrocuting enemies lured inside with animated plasma arcs.
- Visceral zombie dismemberment physics with flying severed limbs, spinning bone splinters, and landing blood decals on critical kills, Boss defeats, and Nuke blasts.
- Elite Affix mutation system (Frost slowing aura, Swift sprint with a telegraphed rush, Armored barrier) with distinct crests and threat radar tracking.
- Boss and Swift-elite charges use direction-locked, dashed-lane telegraphs before impact; mobile players can evade with the Dash button, while desktop players press Space.
- Endless director: four-wave stages with buildup, pressure, blackout, and boss phases; independently seeded encounter bags; bounded relief after damage or crowding; and six-second boss-defeat recovery windows.
- Dynamic combo kill streak system with decay timer, rising kill pitch synthesis, multi-tier speed/crit buffs (×10, ×25, ×50), fanfare bursts, and defeat screen Max Combo tracking.
- Survivor visual polish: Tactical Combat Helmet, dynamic state-colored illuminated visor, pulsing shoulder beacon, footstep dust kick, aiming laser guide ray, and holographic distress invulnerability shimmer.
- Off-screen tactical threat radar rendering edge warning chevrons for approaching fast runners, armored tanks, and lunging bosses.
- Dynamic tactical combat pickups (Tactical Nuke, Overdrive Frenzy, Field Medkit, Super Magnet) with screen-clearing blasts and electric lightning aura.
- High-energy laser beam tracers with color-coded plasma cores (gold for crits, cyan for piercing, neon emerald for standard) and adaptive multi-spark muzzle flare.
- Tiered weapon audio synthesis with layered harmonic resonance for multi-shot volleys and heavy caliber sub-bass kick.
- Roguelike 3-choice level-up upgrade system with 8 build-crafting abilities (Spread Shot, Rapid Fire, Heavy Ammo, Piercing Rounds, Field Medkit, Agility, Magnetic Collector, Critical Strike).
- Three exclusive build paths with six specializations and path-specific Tesla, Plasma, or Phase Drive evolutions.
- Dynamic Reactor Blackout events with factory lights shutdown, tactical conical flashlight beam, glowing zombie predator eyes, and guaranteed dual-drop supply cache rewards.
- Waves, experience orbs, automatic level upgrades, score, kills, and local best score.
- Responsive HUD, safe-area handling, portrait and landscape mobile layouts.
- Offline application shell through a service worker.
- Install button for browsers supporting `beforeinstallprompt`.
- iOS installation guidance through **Share → Add to Home Screen**.
- Service-worker update detection with an explicit update action.
- Adaptive visual performance mode based on measured frame rate.
- Reduced-motion support through `prefers-reduced-motion`.
- Localized UI in English, Simplified Chinese, Malay, Japanese, Korean, Vietnamese, and Thai.
- Browser-language detection with a persisted language selection.
- Unified compact top status bar (brand, quick pause, HP/XP meters, wave/kills/time, score/best, settings) reclaiming over 80px of vertical combat view.
- Explicit pause/resume mechanism: pause button in header, 'P'/'Escape' hotkeys, and auto-pause on opening the settings menu or switching browser tabs.
- Dedicated pause overlay dialog with blurred/dimmed canvas backdrop.
- Collapsible settings menu (language, install, update, and FPS/performance diagnostics) behind a single header trigger, with focus trap, outside-click, and Escape handling.
- Full-screen defeat overlay: blurred/dimmed backdrop, hero score, S/A/B/C Survival Rank, tactical build matrix with level chips, wave/kills/combo/time stats, "NEW BEST!" achievement banner, clipboard run sharing, and a dedicated Restart button.

## Project Structure

```text
.
├── index.html              # Application shell and accessible UI structure
├── style.css               # Layout, responsive rules, theme, and controls
├── manifest.webmanifest    # PWA metadata and icons
├── service-worker.js       # App-shell cache and update lifecycle
├── icon-192.png           # Standard PWA icon size
├── icon-512.png           # Standard PWA icon size
└── src/
    ├── main.js             # Resize handling and animation frame loop
    ├── state.js            # DOM references and game state
    ├── audio.js            # Web Audio API procedural sound synthesis and mute toggle
    ├── haptics.js          # Vibration API tactile pulse feedback and toggle
    ├── entities.js         # Simulation, enemies, combat, waves, and scoring
    ├── wave-director.js    # Wave plans, encounter bags, difficulty, event scheduling, and relief
    ├── ranged-combat.js    # Spitter attack state and shared projectile/telegraph collision geometry
    ├── telegraphed-charge.js # Deterministic windup / charge state machine
    ├── playtest-analysis.js # Phase, build, damage, and outcome summaries
    ├── game-ui.js          # Upgrade, pause, and game-over presentation
    ├── focus-trap.js       # Keyboard focus containment for active dialogs
    ├── render.js           # Canvas map, lighting, entities, and effects rendering
    ├── effects.js          # Particles, decals, and adaptive performance mode
    ├── input.js            # Keyboard and pointer input
    ├── ui.js               # HUD and transient messages
    ├── pwa.js              # Install and service-worker update UX
    ├── i18n.js             # Supported locales, translations, and locale persistence
    ├── i18n-apply.js       # Translation application and language selector
    ├── settings-menu.js    # Collapsible settings panel (open/close, focus, outside-click)
    └── utils.js             # Shared utility functions
```

## Run Locally

This is a static application with no `package.json`, build script, or development server. Its automated checks use Node's built-in test runner and can be run with the command in **Verification Status**.

Use any local HTTP server from the repository root. For example:

```bash
python -m http.server 8080
```

Open <http://localhost:8080/> in a browser. Do not open `index.html` directly with `file:` when testing PWA behavior; service workers require a secure context such as HTTPS or localhost.

## GitHub Pages Deployment

The repository is a zero-build static site and includes `.github/workflows/deploy-pages.yml`. Pushes to `main` and manual workflow runs deploy the repository root through GitHub Pages.

In the repository settings, open **Settings → Pages** and set the source to **GitHub Actions**. After the workflow completes, the project URL is:

<https://yapweijun1996.github.io/PWA-Game-Zombie-Room/>

## Controls

- **Desktop:** `W`, `A`, `S`, `D`, or arrow keys to move; `Space` to evasive-dash; `P` or `Escape` to pause/resume.
- **Mobile:** 360-degree floating virtual joystick with analog deflection and speed scaling; tap **Dash** for a directional evade (8-second prototype cooldown).
- **Restart after defeat:** tap the joystick, press any movement direction, or tap the Restart button.
- **Combat:** shooting and target selection are automatic.

## PWA and Mobile Compatibility

### Android and Chromium browsers

The app provides a web app manifest, icons, service-worker registration, install-prompt handling, offline fallback, and an update flow. Chromium may show the native install prompt when the browser considers the app installable. The in-app install button falls back to browser-menu instructions when the prompt is unavailable.

### iOS and iPadOS

iOS does not expose the Chromium `beforeinstallprompt` flow. The app detects iOS and provides **Share → Add to Home Screen** instructions. Standalone mode is detected with both `display-mode: standalone` and `navigator.standalone`.

The current manifest and meta tags cover the main standalone experience. iOS behavior should still be verified on a real device, especially safe-area spacing, viewport height, audio policy if audio is added later, and the Home Screen launch path.

### Zoom and accessibility

The app intentionally disables page zoom with `maximum-scale=1` and `user-scalable=no`, and uses `touch-action: none` to preserve fixed, full-screen game controls and prevent page gestures from interrupting play. This is a product requirement; do not restore pinch-zoom without an explicit product decision. It does create an accessibility trade-off for users who rely on zoom, so keep controls legible and large, retain keyboard operation and visible focus styles, and verify the intended behavior on target iOS and Android browsers.

### Responsive behavior

The layout currently supports:

- Safe-area insets for notches and home indicators.
- Short-height devices through compact HUD and control rules.
- Landscape mobile through a right-side D-pad layout.
- Desktop keyboard mode at `800px` width with a fine pointer.
- Narrow screens down to approximately `320px` through compact header and HUD rules.

Real-device testing remains necessary for Safari, Chrome Android, iOS standalone mode, Android standalone mode, portrait, landscape, short viewport heights, and browser UI expansion/collapse.

## Current Design Assessment

### Gameplay

Version 3.6.0 introduces the endless director. The product target is for familiar players to feel substantial pressure after 3–5 minutes, with no final wave. This is a tuning target, not a verified human-playtest result. Version 3.7.0 adds exclusive build paths. Nine synthetic runs across all three paths still reached five minutes at full health/shield; the pressure target remains unverified. See the versioned verification evidence below.

The player retains automatic targeting, Dash, eight ordinary upgrades, combo bonuses, pickups, and the regenerating shield. Each run can now gain one of three path-specific weapon evolutions. All incoming damage, including enemy projectiles, uses the existing 0.58-second invulnerability window. No adaptive changes are made to enemy attributes, player upgrades, or rewards.

#### Director rules

A wave lasts 25 simulation seconds. Each four-wave stage lasts 100 seconds:

| Wave within stage | Phase | Spawn rate multiplier |
| --- | --- | --- |
| 1 | Buildup | 0.75 |
| 2 | Pressure | 1.00 |
| 3 | Blackout | 0.65 |
| 4 | Boss | 0.42 |

The first Boss is due at 75 seconds. Blackouts occur on waves 3, 7, 11, and so on, eight seconds into the wave, and last 12 seconds. The director is the only event scheduler. A living Boss prevents another Boss or blackout; blocked requests are discarded instead of accumulating. Defeating a Boss gives six seconds at a 0.25 spawn rate, with only unaffixed walkers. Recovery can delay an event within its wave; a blackout that no longer fits is skipped. A Boss continuing into another wave keeps the ordinary spawn rate at or below 0.42 while the wave and difficulty continue growing.

Rate multipliers divide the base spawn interval: 0.25 means a four-times-longer interval. The base remains `max(0.22, 0.82 - elapsed * 0.0038 - wave * 0.018)`. There is no extra random double-spawn rule. With zero-based stage index `c = floor((wave - 1) / 4)`, ordinary health scales by `1 + 0.08 * (wave - 1) + 0.25 * c`; Boss health uses `0.14` per wave. Elite probability is capped at 40%. Enemy movement is capped at 160 CSS pixels/second, or 360 during a charge. Telegraph durations do not shrink with difficulty.

Total enemies are capped at 90; ordinary spawns reserve a slot for the Boss. Starting at wave 5, buildup and pressure waves draw from a seed-derived shuffle bag with no adjacent repeats. The bag is independent of combat/upgrade RNG:

| Encounter | Walker / runner / tank / spitter | Preferred elite affix |
| --- | --- | --- |
| Rush | 45% / 40% / 5% / 10% | Swift |
| Blockade | 40% / 15% / 35% / 10% | Armored |
| Crossfire | 45% / 15% / 15% / 25% | Frost |

Preferred affixes receive 60% of elite selections. Special phases, a living Boss, blackout, and recovery suppress new spitters. Spitter quotas are two in stage 2, three in stage 3, and four thereafter; a rejected spitter selection immediately becomes a walker.

Actual shield plus HP loss of at least 20% of maximum HP within five seconds, or eight enemies within 90 pixels, can pause new enemy spawns for three seconds. Relief has a global 25-second cooldown. Existing enemies/attacks remain active; the wave clock keeps advancing. The spawn countdown freezes without banking a burst, and relief cannot extend or stack with recovery.

#### Ranged combat and readability

Spitters have base HP 3, speed 65, contact damage 8, score 20, and XP 2. They approach to 120–220 pixels, retreat when too close, and may begin an attack only fully inside the room with clear line of sight. A 0.8-second telegraph locks the shot direction; a single non-homing projectile follows, then a 3.2-second cooldown. A shared 1.2-second gate staggers windups. Spitters do not receive elite affixes.

Projectiles travel at 170 pixels/second, have radius 5, deal 8 damage, and expire after two seconds; at most 12 may exist. Swept collision consumes them on pillars, room boundaries, or the player, including during invulnerability. Killing a winding-up spitter cancels its attack; a Nuke clears existing enemy projectiles. The telegraph ends at the same cover/boundary as the shot. Enemy shots and their warning lines remain visible above blackout lighting in ECO mode.

The compact wave HUD shows stage, wave, and encounter, with a full accessible label and a three-second upcoming-wave message. New strings cover all seven supported locales. Existing best scores remain stored; scores recorded under a different app version receive an asterisk and an explanation in Settings until exceeded under the new rules.

#### Build paths (v3.7)

Level 4 replaces one normal upgrade choice with three exclusive paths. Level 8 replaces one choice with two specializations for the selected path. Each selection consumes one earned upgrade and is locked for the run; queued level-ups continue normally, and restarting clears the entire build. Auto-fire and ordinary upgrade choices remain available.

| Path | Combat behavior and cost | Exclusive evolution and prerequisites |
| --- | --- | --- |
| Arc Circuit | Direct damage ×0.85; each bullet's first hit arcs to one enemy within 110 px for 55% of bullet damage | Tesla: multishot 3 and piercing 3; three arc targets at 75% damage |
| Scatter Cannon | Two extra pellets, 0.22-radian spacing, 16 px knockback; pellet damage ×0.65 and lifetime 0.55s (253 px range) | Plasma: damage 3 and rapid fire 3; two more pellets and 36 px knockback |
| Mobile Striker | Dash cooldown 5s; after Dash, fire interval ×0.65 for 2s; bullet damage ×0.85 | Phase Drive: agility 2 and critical 2; burst lasts 1s longer and bullets pierce two extra enemies during it |

Each specialization preserves a tradeoff, including after evolution:

| Path | Specialization | Change |
| --- | --- | --- |
| Arc | Forked Circuit | Two extra arc targets; arc damage ×0.65 |
| Arc | Long Conductor | Arc radius 160 px; firing interval ×1.15 |
| Scatter | Tight Choke | Spacing 0.10 radians and lifetime 0.85s (391 px); one fewer pellet |
| Scatter | Concussion Shells | Knockback ×1.7; pellet damage ×0.85 |
| Mobility | Slipstream | Dash cooldown 4s; base burst duration 1.2s |
| Mobility | Ambush | Burst damage ×1.6; Dash cooldown 6s |

The modal explains costs before selection and shows evolution prerequisites with current progress. Only the selected path's evolution can appear. An icon beside the player level and the defeat-screen build summary retain the choice; mobility bursts also show chevrons behind the player. New interface text covers all seven locales. Short-screen dialogs scroll their card list while keeping the title visible, above the HUD and transient messages.

`src/builds.js` owns build choices, gates, and derived combat profiles; the player owns selected IDs and the burst timer. Stats are derived from ordinary upgrades rather than repeatedly multiplying stored player attributes. `src/entities.js` executes those profiles and snapshots bullet properties at firing time. Piercing bullets now hit each enemy at most once instead of applying damage repeatedly during overlap. Secondary arcs respect their own target's armor. Burst timers freeze during pause/upgrade dialogs. The director rules remain unchanged.

Build choices use the existing ordered upgrade events; checkpoints/final snapshots and analysis signatures include path and specialization. Replay format remains 4, with exact app-version rejection preventing older recordings from being interpreted under v3.7 rules. Scores/settings are preserved; previous-version best scores remain explicitly marked. The service-worker version and precache include the new build module.

Ordinary upgrades still have finite caps. Six final build combinations preserve different combat patterns after those caps; they do not provide unlimited new content. Optional objectives remain future work.

### UI and UX

- Done: Top App Bar and HUD consolidated into a single compact status strip; duplicate level metric removed; FPS/performance diagnostics relocated into the settings panel; full pause/resume lifecycle added (header button, hotkey, tab switch, settings menu auto-pause); defeat screen enhanced with Wave reached, "NEW BEST!" banner, and dedicated Restart button.
- Done: Web Audio procedural sound effects engine with persisted sound toggle switch in the settings menu.
- Add reduced-motion toggles to the settings menu.
- Add stronger visual distinction between player, XP, bullets, runners, tanks, and bosses for color-blind users using shape, pattern, and animation in addition to color.
- Add explicit focus-visible styles and test all controls with keyboard and switch-like pointer input.

### Layout and map

The room has a strong industrial visual language with solid spatial tactical depth:

- Done: Tactical industrial cover pillars with dynamic Circle-AABB physics collision, projectile spark absorption, hazard stripes, and status LEDs, supporting figure-8 kite loops.
- Fixed desktop spawn collision: when the room is at least 640×380, the terminal pillar is placed at room center, where the player also spawns by default. `resetGame()` now resolves the player against obstacles, and the collision resolver ejects entities whose centers are already inside an AABB. Browser checks covered the 929×861 spawn, inside/edge collision cases, a resize that introduced an overlap, and a 390×844 reset; repeat on real devices.
- Done: Dynamic environmental electrical hazard zones with alternating charge cycles, warning sparks, and high-voltage discharge for luring and frying zombie hordes.
- Done: Off-screen tactical threat radar rendering edge warning chevrons (red double chevrons with localized badge for Bosses, amber chevrons for fast runners, olive for tanks) to prevent off-screen ambushes.
- Use a small number of readable obstacles rather than dense decoration.
- Keep a clear movement path on small screens and ensure enemies cannot hide behind UI.

### Hero avatar and readability

The survivor has high-contrast tactical readability across all battlefield states:

- Done: Tactical Combat Helmet with reinforced brow rim, dynamic state-colored visor (green/amber/blue/red), and specular reflection glint.
- Done: Pulsing high-contrast shoulder beacon LED for instant identification against dense dark-green zombie swarms.
- Done: Subtle sprint footstep dust kick grounded to the industrial floor.
- Done: Tactical dashed laser guide ray projecting auto-aim target direction.
- Done: Holographic protective distress shimmer replacing full invisible blinking during invulnerability.
- A short spawn and defeat animation so state changes are easier to understand.

### Color and visual hierarchy

The green industrial palette is cohesive. The main risk is that green, blue, yellow, and red effects compete against a dark background while the HUD uses several small low-contrast labels.

Recommended semantic palette:

- Green: player, safe state, upgrade confirmation.
- Blue: XP and progression.
- Amber: warnings, runners, hazards, telegraphs.
- Red/pink: damage, bosses, defeat.
- White: primary readable information and projectiles.

Use shape and motion as secondary signals, and validate text and control contrast against WCAG AA targets. Do not make a color-only distinction between enemy types.

## Performance Review

The implementation already includes several good safeguards:

- Device pixel ratio is capped at `2`.
- Frame delta is capped at `34ms`.
- Zombie count, particle count, and decal count are bounded.
- An ECO mode disables some expensive gradients and reduces effect budgets.
- Visibility changes reset timing and performance warm-up state.
- Canvas rendering is used instead of a large DOM entity tree.

Prioritized performance improvements:

1. Profile on low-end Android and older iPhones before changing rendering code.
2. Avoid creating gradients and temporary arrays in every frame where a cached gradient or simpler shape is sufficient.
3. Replace repeated `Array.prototype.filter` and array splicing in hot paths with bounded reuse or pools if profiling shows pressure.
4. Update HUD text at a lower frequency, such as 10–15 times per second, instead of every simulation frame.
5. Consider a lower internal render scale on devices that remain below the target frame rate after ECO mode.
6. Add a debug-only frame-time panel rather than exposing FPS as permanent gameplay UI.

The target should be stable 60 FPS on modern devices and a playable fallback near 30 FPS on constrained devices. This must be measured on representative hardware rather than inferred from desktop testing.

## PWA Standards and Release Checklist

Before release, verify the following on HTTPS and localhost:

- [ ] Manifest is valid and has `name`, `short_name`, `start_url`, `scope`, `display`, theme/background colors, and icons.
- [ ] Icons are valid PNGs at 192×192 and 512×512 and remain legible as maskable icons.
- [ ] Service worker installs, activates, serves the complete shell offline, and removes old versioned caches.
- [ ] Every imported JavaScript module, including `src/i18n.js` and `src/i18n-apply.js`, is included in the app-shell cache.
- [ ] A newly deployed version is detected and the update action reloads exactly once.
- [ ] Navigation fallback works when offline.
- [ ] No stale HTML or JavaScript remains after an update.
- [ ] Install behavior is verified on Chrome Android and iOS Safari.
- [ ] Standalone layout is verified with safe-area insets on notched devices.
- [ ] The app remains usable at short heights and in landscape orientation.
- [ ] Keyboard focus, screen-reader labels, reduced motion, and non-color state cues are verified.
- [ ] No runtime errors appear during a complete run, defeat, restart, install attempt, update attempt, and offline reload.

## Recommended Roadmap

### P0 — Release safety and usability

- Test the current PWA on real iOS and Android devices.
- Verify intentional zoom prevention and full-screen gesture behavior on iOS Safari and Chrome Android; do not enable user zoom without an explicit product decision.
- Audit focus-visible styling and non-color feedback across every interactive and game state.
- Add a basic automated smoke check for manifest, service-worker registration, and offline navigation.

### P1 — Gameplay depth and balance

- Investigate the reported “too easy” feedback with repeated runs across early, mid, and late waves; establish a target survival curve before changing balance values.
- Repeat balance trials with physical touch input on target devices and varied viewport sizes; the current scripted samples are too small to set a difficulty target.
- Add distinct, telegraphed enemy attacks and tune movement, shield recharge, spawn pacing, and enemy composition from observed results; avoid increasing health or spawn counts blindly.
- Refine the existing level-up choices and combat pickup balance based on observed builds and runs.
- Verify existing room obstacles and hazards have predictable movement and collision behavior across viewport sizes.
- Verify synthesized audio unlock and mute persistence across supported mobile and standalone browsers.
- Add optional local run history only if playtest comparisons need it; do not collect personal data.

### P2 — Polish and scale

- Add multiple room layouts or a lightweight procedural room system.
- Add richer hero animation and enemy silhouettes.
- Profile and optimize only the hot paths confirmed by low-end device traces.
- Expand browser regression coverage for standalone flows and broader responsive layouts; the new dash control currently has desktop, portrait, and landscape emulation checks.

## Verification Status

No `package.json` or build configuration is present. Run all checks with `node --test tests/*.test.mjs`. Browser tests use Node's built-in WebSocket and an installed Edge/Chrome browser; they auto-skip locally if unavailable. Set `PLAYTEST_BROWSER` to an executable or `PLAYTEST_REQUIRE_BROWSER=1` to require browser support. GitHub Actions runs the same suite and deploys only after it passes. No packages are installed by the tests.

Unit checks cover 1,000-wave growth, shuffled encounter bags, pacing boundaries, ranged state transitions, shared collision geometry, and descriptive analysis. Browser checks retain controls/focus/replay regressions, add ranged combat, caps, pause/reset, seeded balance comparisons, controlled late/saturated scenarios, and real service-worker offline startup. Browser harness utilities are shared without adding runtime dependencies.

The browser fixture explicitly sets a fine desktop pointer through Chromium's Blink settings (`primaryPointerType=4,availablePointerTypes=4`). Disabling touch emulation alone restores the host's pointer capabilities, which can be `pointer: none` on headless Linux runners. Apply the desktop viewport and disable touch before navigation so the new page receives those settings. The test asserts coarse pointers in portrait/landscape and a fine pointer on desktop before checking controls; keep these preconditions when changing browser setup, and verify on Linux as well as a local desktop.

Wait for the game's debounced viewport update after resizing, and reset the game before manually advancing a new simulation scenario. A fixed sleep can leave a previous live Dash active and change the next scenario's charge direction.

For opt-in repeatable local trials, load the app with `?playtestSeed=123456&playtestLimit=180&playtestProfile=offense&playtestInput=joystick-loop-v1`. The seed must be an unsigned 32-bit integer; the recording limit defaults to 180 game seconds, and `0` disables it. Reaching the limit finalizes the record but does not stop gameplay. Seeded mode uses a fixed 1/60-second simulation step and records ordered input-state, upgrade-choice, pause, and Dash events alongside five-second checkpoints, damage sources, wave modifiers, director events (including relief, recovery, and shots), and the final outcome. Scenario modifiers are derived from the run seed and wave, independent of build-related gameplay RNG draws. Records remain in memory at `window.__zombieRoomPlaytest` and `window.__zombieRoomPlaytestRuns`; nothing is uploaded or persisted. To replay a completed schema-version-4 record from the same app version, keep a copy with `const source = structuredClone(window.__zombieRoomPlaytest)` and call `window.__zombieRoomPlaytestTools.replay(source)` on a page with a valid `playtestSeed`. The replay produces `replayComparison` evidence; `window.__zombieRoomPlaytestTools.exportRuns()` returns current JSON, and `window.__zombieRoomPlaytestTools.summarizeRuns()` groups completed runs by early (waves 1–2), mid (3–5), and late (6+) phases, build, health samples, damage sources, death causes, outcomes, and modifiers, plus director event counts and the highest stage. `window.__zombieRoomPlaytestTools.stopReplay()` returns to recording mode. Results are in-memory only; the report is descriptive and never tunes balance. Do not increase enemy HP or spawn rate from small or build-skewed samples; compare repeated seeded runs across phases and builds first. Cosmetic effects remain unseeded and do not feed the simulation.

For deterministic automation, also set `playtestManual=1` with a valid seed. This disables automatic simulation stepping and exposes `window.advanceTime(milliseconds)` and `window.render_game_to_text()`; real gameplay is unchanged without this explicit test flag. Profile/input query parameters are descriptive labels, not autopilots. The synthetic controller is implemented in the browser test. Replay format 4 rejects older schemas and other app versions; director decisions are recomputed and compared rather than injected from the source record.

### Version 3.7 development evidence

All 38 checks passed locally with Chrome required and no skips. The automated suite includes build gates, exclusive evolutions, every specialization's cost, non-compounding stats, real combat effects, single-hit piercing, burst expiry, queued upgrades, reset/pause, and build-aware analysis. Browser checks cover all seven locales at 320×568, 390×844, 844×390, 667×320, and 1280×720, including keyboard/touch selection, visible wrapped focus, actual internal scrolling, and dialog layering. Physical devices and human enjoyment remain unverified.

Nine natural synthetic runs used seeds 42, 160501, and 202602 with three policies: offense-priority selected Scatter/Tight Choke; first-card selected Arc/Forked Circuit; mobility-priority selected Mobile Striker/Ambush. All reached the 300-second cap in wave 13, fully upgraded, at 225 HP and 40 shield. Kills ranged 726–747, spitter shots 5–22, and damage events 1–13. Scatter runs recorded one damage event each; Mobility recorded 6–13. These are descriptive results from a controller with full world-state access, not evidence of a best build, representative difficulty, or human retention. The director was not retuned from these results.

Each path completed an exact replay of a naturally recorded run, including its build decisions and director events. Controlled invulnerable Arc fixtures at 10 and 20 minutes exercised another 30 seconds; a separate stationary/no-fire fixture reached 89 enemies/four spitters within caps. Controlled late scenarios are not survival evidence. The new build module is precached and the app starts offline after the HTTP cache is cleared.

### Version 3.6 development evidence (historical)

All 29 local checks passed with Chrome required and no skips, covering the director, ranged combat, controls, exact replay comparisons, and offline startup after clearing the HTTP cache. Controlled screenshots at 390×844, 844×390, and 1280×720 showed the new HUD and ranged warnings; blackout/ECO warnings remained visible with no layout overflow or page exceptions.

The mobile synthetic controller compared seeds 42, 160501, and 202602 with offense-priority and first-card upgrade selection. All six runs reached the 300-second recording cap in wave 13, fully upgraded, at 225 HP and 40 shield. They recorded 738–751 kills, 1–18 spitter shots, and 0–8 damage events. This controller directly reads world positions, avoids enemies/hazards, collects XP, and uses Dash; it is not a human or a retention test. These results flag low ranged-attack exposure and strong-build survivability for further tuning, not achievement of the 3–5-minute pressure target.

Invulnerable, fully upgraded fixtures at 10 and 20 minutes exercised another 30 seconds each; a separate stationary/no-fire saturation fixture reached 89 ordinary enemies and four spitters without exceeding the caps. CPU timings from accelerated browser fixtures are diagnostics, not physical-device FPS measurements or survival evidence.

Human acceptance remains outstanding: recruit at least five familiar players; at least three should report a clear pressure increase around minutes 3–5, identify the main damage source/counterplay, and want another run. Physical iOS/Android behavior and human enjoyment are not verified by the automated suite. Initial tuning constants are intentionally retained pending representative evidence.

### Historical trials before version 3.6

The following results used earlier balance and recording rules and are retained as historical context only.

Two initial exploratory Chrome DevTools runs used a 390×844 mobile/touch emulation, a repeating one-second diagonal WASD pattern, and a consistent upgrade preference (damage, rapid fire, multishot when offered; otherwise the first card). One ended at 19.5 seconds in wave 1 with 18 kills, likely from zombie contact; damage-source recording had not yet been implemented. The other reached the 180-second trial cap in wave 8 with 533 kills, 136/150 HP, 40 shield, and the Plasma Flak evolution. The desktop version was then tested at 929×861 with the same input pattern: it reached the trial cap in wave 8 with 523 kills, 89/100 HP, 40 shield, and both weapon evolutions. Collision fixtures for inside, edge-overlap, and clear positions passed; a resize test fixture placed the player at the future terminal position on a narrow layout and confirmed ejection after widening, and a 390×844 reset remained clear.

Three further trials used 390×844, DPR-3 mobile/touch emulation and synthetic `PointerEvent` touch input through the virtual joystick, cycling eight directions every 0.75 wall seconds. With offense-priority upgrades, one run reached the 180-second cap in wave 8 with 538 kills, 125/125 HP, 40 shield, and both weapon evolutions. A defensive/XP-priority run (two Medkits, then Magnetic Collector; no offensive upgrade selected before death) ended at 44.8 seconds in wave 2 with 35 kills, 0/150 HP, 0 shield, and 33 zombies remaining. Selecting the first offered card each time reached the cap in wave 8 with 555 kills, 225/225 HP, 29 shield, and Tesla evolution. These outcomes suggest upgrade build and unseeded randomness strongly affect survival, but the small sample and repeated movement pattern do not establish overall difficulty.

Before fixed-step replay was added, five seeded exploratory trials used 390×844, DPR-3 mobile/touch emulation, the same synthetic virtual-joystick route (eight directions, changed every 0.75 game seconds), and a 180-second cap. For seed 160501, offense-priority reached the cap in wave 8 with 565 kills, 175/175 HP, 40 shield, and both evolutions; survival-priority died at 41.38 seconds in wave 2 with 43 kills, 0/100 HP, no shield, and walker contact as the last damage source; first-card died at 42.52 seconds in wave 2 with 38 kills and walker contact. For seed 202602, offense-priority reached the cap in wave 8 with 544 kills, 125/125 HP, 40 shield, and both evolutions; first-card reached the cap with 526 kills, 225/225 HP, 40 shield, both evolutions, and one boss remaining. This indicates that upgrade offers/builds can dominate survival even when the movement route is held constant.

A replay verification then recorded a 30-second seed-42 run with synthetic joystick input (390×844, DPR-3) and replayed its 45 ordered events without injecting further controls. The replay matched the source outcome, final snapshot, checkpoints, upgrades, damage events, and random draw count, with zero event mismatches (wave 2, 38 kills, score 489). Earlier seed-only retries differed (35 versus 32 kills), which motivated this replay check. The exact match verifies replay within the tested app/runtime, not bit-identical results across browsers or devices. Pointer input was synthetic rather than physical touch; real-device playtesting remains outstanding. Keyboard focus containment is covered for the tested dialogs, but screen-reader behavior, translation completeness, comprehensive accessibility, physical-device use, offline behavior, and full install/update flows remain unverified.

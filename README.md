# Zombie Room

Zombie Room is an offline-first, canvas-based survival game for desktop and mobile browsers. The player moves in four directions, can trigger a timed evasive dash, and fires automatically. The project is implemented as a dependency-free static web app and installable Progressive Web App (PWA).

## Current Features

- Canvas game loop with automatic targeting and shooting.
- Zero-asset procedural sound effects synthesized via Web Audio API (gunshots, crits, kills, pentatonic XP suction, level-up arpeggios, UI taps) with persisted sound toggle.
- Tactile haptic vibration feedback via the Vibration API with multi-pattern pulses for damage, crits, level-ups, boss spawns, and death, with persisted toggle.
- Dynamic floating combat damage numbers with pop-in scaling, upward drift, alpha fade-out, and distinct gold critical strike callouts.
- 360-degree analog floating virtual joystick for touch devices with dynamic thumb-centering and speed scaling, plus WASD / arrow-key support on desktop.
- Walker, runner, tank, and boss enemy types.
- Cinematic Boss encounters with heavy screen rumble, warning haptics, and a dedicated glowing Boss health bar.
- Boss Phase 2 Frenzy (< 50% HP) with terrifying beast roar audio, flaming red magma visuals, blazing golden eyes, halved dash cooldown, and rapid charges.
- Tactical industrial obstacles and cover pillars providing strategic kiting, line-of-sight protection, and projectile absorption.
- Regenerative Energy Shield system absorbing incoming damage with plasma deflection bubbles, overload break shatter, and auto-recharge delay.
- Dynamic environmental electrical hazard pools with cyclic dormant/warning/active phases, electrocuting enemies lured inside with animated plasma arcs.
- Visceral zombie dismemberment physics with flying severed limbs, spinning bone splinters, and landing blood decals on critical kills, Boss defeats, and Nuke blasts.
- Elite Affix mutation system (Frost slowing aura, Swift sprint with a telegraphed rush, Armored barrier) with distinct crests and threat radar tracking.
- Boss and Swift-elite charges use direction-locked, dashed-lane telegraphs before impact; mobile players can evade with the Dash button, while desktop players press Space.
- Seeded, preannounced elite waves (Swift, Armored, or Frost emphasis) vary affix distribution only—no extra spawns or global health scaling—and skip boss / blackout waves.
- Dynamic combo kill streak system with decay timer, rising kill pitch synthesis, multi-tier speed/crit buffs (×10, ×25, ×50), fanfare bursts, and defeat screen Max Combo tracking.
- Survivor visual polish: Tactical Combat Helmet, dynamic state-colored illuminated visor, pulsing shoulder beacon, footstep dust kick, aiming laser guide ray, and holographic distress invulnerability shimmer.
- Off-screen tactical threat radar rendering edge warning chevrons for approaching fast runners, armored tanks, and lunging bosses.
- Dynamic tactical combat pickups (Tactical Nuke, Overdrive Frenzy, Field Medkit, Super Magnet) with screen-clearing blasts and electric lightning aura.
- High-energy laser beam tracers with color-coded plasma cores (gold for crits, cyan for piercing, neon emerald for standard) and adaptive multi-spark muzzle flare.
- Tiered weapon audio synthesis with layered harmonic resonance for multi-shot volleys and heavy caliber sub-bass kick.
- Roguelike 3-choice level-up upgrade system with 8 build-crafting abilities (Spread Shot, Rapid Fire, Heavy Ammo, Piercing Rounds, Field Medkit, Agility, Magnetic Collector, Critical Strike).
- Super Weapon Synergy Evolutions (Tesla Chain-Lightning & Plasma Flak Cannon) unlocking devastating secondary electric chain arcs and shotgun knockback bursts.
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
    ├── wave-director.js    # Seed-independent modifier selection and elite-affix weighting
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

The core loop is clear and immediately playable. Player feedback reports that the current game feels too easy. This is qualitative feedback, not yet backed by controlled playtest results; treat difficulty tuning as an open priority rather than assuming one numeric change will solve it.

Likely factors to validate include the survivor's 180 speed versus a wave-1 walker's 49.7 speed, nearest-target auto-fire every 0.38 seconds, and the starting 100 HP plus 40-point shield that regenerates after damage-free time. Player damage, fire rate, projectile count, and movement can grow through upgrades; combo streaks also grant speed and critical-hit bonuses. By contrast, basic enemy health grows by 8% per wave, while contact-damage values stay fixed by enemy type. All incoming damage is gated by the same 0.58-second invulnerability window, so additional enemies do not stack damage during that interval. These differences may make early or mid-game kiting and survivability too forgiving, but they are hypotheses, not proof.

The opposing pressure is also significant: the spawn interval falls from about 0.80 seconds at the start toward a 0.22-second floor, and enemy health continues scaling. Balance may therefore diverge between early and late waves or between upgrade builds. Compare runs by wave reached, duration, build, and cause of death before tuning. Initial scripted browser trials at the same narrow viewport produced very different outcomes; because upgrade and spawn randomness were not seeded and inputs were synthetic, treat them as exploratory evidence only (see Verification Status). Prefer readable enemy pressure and telegraphed attacks over an unmeasured blanket increase to health or spawn counts.

With upgrades and combat pickups already in place, the current gameplay focus is making threats readable, adding one deliberate movement decision, and collecting phase/build evidence before tuning difficulty:

1. Done: Roguelike 3-choice level-up upgrade system with 8 synergistic abilities (spread shot, rapid fire, heavy ammo, pierce, medkit, agility, magnet, critical strike), with number keys (1, 2, 3) or tap selection.
2. Done: Boss and Swift-elite attacks now have direction-locked dashed-lane telegraphs and a windup; continue validating reaction windows before numeric difficulty changes.
3. Done: Dynamic tactical combat pickups (Tactical Nuke screen-clearing shockwave, Overdrive 2x attack speed, Field Medkit, Super Magnet vacuum).
4. Done: Comprehensive run summary with S/A/B/C Survival Rank evaluation, active tactical build matrix with ability level chips, Max Combo, and one-tap clipboard run sharing.
5. Done: pause/resume for mobile app switching, settings menu opening, and visibility changes.
6. Done: optional evasive Dash on Space / touch, with visible, localized accessible cooldown state while auto-fire remains unchanged.
7. Done: seeded, warned wave affix variations and in-memory phase/build/death-cause summaries; no automatic balance tuning or blanket HP/spawn changes.

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

No `package.json` or build configuration is present. Run all checks with `node --test tests/playtest-rng.test.mjs tests/playtest-replay.browser.test.mjs tests/wave-director.test.mjs tests/telegraphed-charge.test.mjs tests/playtest-analysis.test.mjs`. The browser test uses Node's built-in WebSocket and an installed Edge/Chrome browser; it auto-skips locally if either is unavailable. It checks seeded replay (including Dash), mobile and desktop controls, charge and wave transitions, normal unseeded startup, and dialog focus behavior. Set `PLAYTEST_BROWSER` to select a browser executable, or `PLAYTEST_REQUIRE_BROWSER=1` to make missing browser support fail. GitHub Actions requires the browser test and deploys only after all checks pass. No packages are installed by the tests.

For opt-in repeatable local trials, load the app with `?playtestSeed=123456&playtestLimit=180&playtestProfile=offense&playtestInput=joystick-loop-v1`. The seed must be an unsigned 32-bit integer; the recording limit defaults to 180 game seconds, and `0` disables it. Reaching the limit finalizes the record but does not stop gameplay. Seeded mode uses a fixed 1/60-second simulation step and records ordered input-state, upgrade-choice, pause, and Dash events alongside five-second checkpoints, damage sources, wave modifiers, and the final outcome. Scenario modifiers are derived from the run seed and wave, independent of build-related gameplay RNG draws. Records remain in memory at `window.__zombieRoomPlaytest` and `window.__zombieRoomPlaytestRuns`; nothing is uploaded or persisted. To replay a completed schema-version-3 record from the same app version, keep a copy with `const source = structuredClone(window.__zombieRoomPlaytest)` and call `window.__zombieRoomPlaytestTools.replay(source)` on a page with a valid `playtestSeed`. The replay produces `replayComparison` evidence; `window.__zombieRoomPlaytestTools.exportRuns()` returns current JSON, and `window.__zombieRoomPlaytestTools.summarizeRuns()` groups completed runs by early (waves 1–2), mid (3–5), and late (6+) phases, build, health samples, damage sources, death causes, outcomes, and modifiers. `window.__zombieRoomPlaytestTools.stopReplay()` returns to recording mode. Results are in-memory only; the report is descriptive and never tunes balance. Do not increase enemy HP or spawn rate from small or build-skewed samples; compare repeated seeded runs across phases and builds first. Cosmetic effects remain unseeded and do not feed the simulation.

Two initial exploratory Chrome DevTools runs used a 390×844 mobile/touch emulation, a repeating one-second diagonal WASD pattern, and a consistent upgrade preference (damage, rapid fire, multishot when offered; otherwise the first card). One ended at 19.5 seconds in wave 1 with 18 kills, likely from zombie contact; damage-source recording had not yet been implemented. The other reached the 180-second trial cap in wave 8 with 533 kills, 136/150 HP, 40 shield, and the Plasma Flak evolution. The desktop version was then tested at 929×861 with the same input pattern: it reached the trial cap in wave 8 with 523 kills, 89/100 HP, 40 shield, and both weapon evolutions. Collision fixtures for inside, edge-overlap, and clear positions passed; a resize test fixture placed the player at the future terminal position on a narrow layout and confirmed ejection after widening, and a 390×844 reset remained clear.

Three further trials used 390×844, DPR-3 mobile/touch emulation and synthetic `PointerEvent` touch input through the virtual joystick, cycling eight directions every 0.75 wall seconds. With offense-priority upgrades, one run reached the 180-second cap in wave 8 with 538 kills, 125/125 HP, 40 shield, and both weapon evolutions. A defensive/XP-priority run (two Medkits, then Magnetic Collector; no offensive upgrade selected before death) ended at 44.8 seconds in wave 2 with 35 kills, 0/150 HP, 0 shield, and 33 zombies remaining. Selecting the first offered card each time reached the cap in wave 8 with 555 kills, 225/225 HP, 29 shield, and Tesla evolution. These outcomes suggest upgrade build and unseeded randomness strongly affect survival, but the small sample and repeated movement pattern do not establish overall difficulty.

Before fixed-step replay was added, five seeded exploratory trials used 390×844, DPR-3 mobile/touch emulation, the same synthetic virtual-joystick route (eight directions, changed every 0.75 game seconds), and a 180-second cap. For seed 160501, offense-priority reached the cap in wave 8 with 565 kills, 175/175 HP, 40 shield, and both evolutions; survival-priority died at 41.38 seconds in wave 2 with 43 kills, 0/100 HP, no shield, and walker contact as the last damage source; first-card died at 42.52 seconds in wave 2 with 38 kills and walker contact. For seed 202602, offense-priority reached the cap in wave 8 with 544 kills, 125/125 HP, 40 shield, and both evolutions; first-card reached the cap with 526 kills, 225/225 HP, 40 shield, both evolutions, and one boss remaining. This indicates that upgrade offers/builds can dominate survival even when the movement route is held constant.

A replay verification then recorded a 30-second seed-42 run with synthetic joystick input (390×844, DPR-3) and replayed its 45 ordered events without injecting further controls. The replay matched the source outcome, final snapshot, checkpoints, upgrades, damage events, and random draw count, with zero event mismatches (wave 2, 38 kills, score 489). Earlier seed-only retries differed (35 versus 32 kills), which motivated this replay check. The exact match verifies replay within the tested app/runtime, not bit-identical results across browsers or devices. Pointer input was synthetic rather than physical touch; real-device playtesting remains outstanding. Keyboard focus containment is covered for the tested dialogs, but screen-reader behavior, translation completeness, comprehensive accessibility, physical-device use, offline behavior, and full install/update flows remain unverified.

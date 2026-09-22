# Zombie Room

Zombie Room is an offline-first, canvas-based survival game for desktop and mobile browsers. The player moves with four directions while the weapon fires automatically. The project is implemented as a dependency-free static web app and installable Progressive Web App (PWA).

## Current Features

- Canvas game loop with automatic targeting and shooting.
- 360-degree analog floating virtual joystick for touch devices with dynamic thumb-centering and speed scaling, plus WASD / arrow-key support on desktop.
- Walker, runner, tank, and boss enemy types.
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
- Full-screen defeat overlay: blurred/dimmed backdrop, hero score, wave/kills/time stats, "NEW BEST!" achievement banner, and a dedicated Restart button in addition to keyboard/D-pad restart.

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
    ├── entities.js         # Simulation, enemies, combat, waves, and scoring
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

This is a static application and does not currently contain a package manager, build script, test script, or development server.

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

- **Desktop:** `W`, `A`, `S`, `D`, or the arrow keys (`P` or `Escape` to pause/resume).
- **Mobile:** 360-degree floating virtual joystick with analog deflection and speed scaling.
- **Restart after defeat:** tap the joystick, press any movement direction, or tap the Restart button.
- **Combat:** shooting and target selection are automatic.

## PWA and Mobile Compatibility

### Android and Chromium browsers

The app provides a web app manifest, icons, service-worker registration, install-prompt handling, offline fallback, and an update flow. Chromium may show the native install prompt when the browser considers the app installable. The in-app install button falls back to browser-menu instructions when the prompt is unavailable.

### iOS and iPadOS

iOS does not expose the Chromium `beforeinstallprompt` flow. The app detects iOS and provides **Share → Add to Home Screen** instructions. Standalone mode is detected with both `display-mode: standalone` and `navigator.standalone`.

The current manifest and meta tags cover the main standalone experience. iOS behavior should still be verified on a real device, especially safe-area spacing, viewport height, audio policy if audio is added later, and the Home Screen launch path.

### Zoom and accessibility

The viewport currently contains `user-scalable=no`, and the page uses `touch-action: none` to keep the game surface responsive. This intentionally prevents pinch-zoom during play, but it is not ideal for accessibility because it prevents users from zooming the interface.

Before release, prefer a game-only interaction strategy that prevents accidental page gestures without globally disabling user zoom. Keep controls large, maintain visible focus styles for keyboard users, and verify the result with browser accessibility checks.

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

The core loop is clear and immediately playable. The main improvement opportunity is adding meaningful player decisions beyond movement:

1. Add a short-term choice after level-up, such as selecting one of three upgrades.
2. Add distinct enemy telegraphs and attack patterns before increasing enemy health or spawn counts.
3. Add room objectives, pickups, or temporary abilities to prevent the loop from becoming movement-only.
4. Add a clearer difficulty curve and a run summary showing the build, wave reached, and best-run comparison.
5. Add pause/resume for mobile app switching and visibility changes.

### UI and UX

- Done: Top App Bar and HUD consolidated into a single compact status strip; duplicate level metric removed; FPS/performance diagnostics relocated into the settings panel; full pause/resume lifecycle added (header button, hotkey, tab switch, settings menu auto-pause); defeat screen enhanced with Wave reached, "NEW BEST!" banner, and dedicated Restart button.
- Add sound and reduced-motion toggles to the settings menu.
- Add stronger visual distinction between player, XP, bullets, runners, tanks, and bosses for color-blind users using shape, pattern, and animation in addition to color.
- Add explicit focus-visible styles and test all controls with keyboard and switch-like pointer input.

### Layout and map

The room has a strong industrial visual language, but the playable area is currently one bounded arena with decorative details. A next step would be to introduce light spatial strategy without requiring a full procedural map:

- Add cover, hazards, doors, or temporary safe zones.
- Use a small number of readable obstacles rather than dense decoration.
- Keep a clear movement path on small screens and ensure enemies cannot hide behind UI.
- If the camera becomes scrollable, add a minimap or off-screen enemy indicators.

### Hero avatar and readability

The current survivor is recognizable at the game scale and has a directional weapon, backpack, shadow, and movement animation. Improve identity and combat readability with:

- One high-contrast silhouette feature, such as a helmet, scarf, or bright shoulder light.
- A stronger hit/invulnerability indicator that does not rely only on blinking.
- A distinct muzzle direction and target indicator when many enemies overlap.
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
- Reconsider global `user-scalable=no` and verify accessible zoom behavior.
- Add focus-visible styles and non-color feedback for game states.
- Add a basic automated smoke check for manifest, service-worker registration, and offline navigation.

### P1 — Gameplay depth

- Add level-up choices, active abilities, and a small set of telegraphed attacks.
- Add room obstacles or hazards with predictable collision rules.
- Add audio with a user-initiated mute toggle and mobile-safe activation.
- Add run history or best-run metadata without collecting personal data.

### P2 — Polish and scale

- Add multiple room layouts or a lightweight procedural room system.
- Add richer hero animation and enemy silhouettes.
- Profile and optimize only the hot paths confirmed by low-end device traces.
- Add automated browser regression coverage for responsive and standalone states.

## Verification Status

No package manager manifest (`package.json`), build configuration, or test configuration was present in the inspected working tree. The source includes seven UI locales, but translation completeness and language switching still require browser verification. The service-worker shell list also requires verification against all imported modules before claiming first-install offline support. This README documents the source and static assets; runtime, real-device, accessibility, offline, and install/update behavior still require explicit verification.

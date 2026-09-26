import assert from 'node:assert/strict';
import test from 'node:test';
import { withBrowser, waitFor, requireBrowser, skipReason } from './browser-harness.mjs';

const browserOptions = { skip: requireBrowser ? false : skipReason, timeout: 180000 };
async function openManual(cdp, url, seed = 42, limit = 300) {
  await cdp.send('Page.navigate', { url: `${url}/?playtestSeed=${seed}&playtestLimit=${limit}&playtestManual=1` });
  await waitFor(cdp.evaluate.bind(cdp), 'typeof window.advanceTime === "function"', Boolean);
}

test('director combat integration, bounded threats, pause and reset', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await openManual(cdp, url);
    const result = await cdp.evaluate(`(async () => {
      const { game, room, input } = await import('./src/state.js');
      const { resetGame, update, spawnPickup, activateDash, setPaused, openUpgradeModal, closeUpgradeModal } = await import('./src/entities.js');
      const { createSpitAttack, createEnemyProjectile } = await import('./src/ranged-combat.js');
      const { createDirectorState } = await import('./src/wave-director.js');
      const makeSpitter = (x, y) => ({ x, y, r: 12, type: 'spitter', hp: 999, maxHp: 999, speed: 65, damage: 8, color: '#dc8bff', xp: 2, score: 20, hitFlash: 0, attackFlash: 0, walkTime: 0, spit: createSpitAttack() });
      const setup = () => {
        resetGame(); room.obstacles = []; room.hazards = [];
        game.elapsed = 100; game.wave = 5; game.director = createDirectorState(42);
        game.director.wave = 5; game.spawnTimer = 100;
        Object.assign(game.player, { x: room.x + 250, y: room.y + 200, shootTimer: 100, invuln: 0 });
        return game.player;
      };
      let player = setup();
      const spitter = makeSpitter(player.x - 150, player.y);
      game.zombies.push(spitter);
      update(1 / 60);
      const started = spitter.spit.state === 'windup';
      const snapshot = JSON.stringify({ elapsed: game.elapsed, spit: spitter.spit, director: game.director, cooldown: game.spitCooldown });
      setPaused(true); update(1);
      const pauseFrozen = snapshot === JSON.stringify({ elapsed: game.elapsed, spit: spitter.spit, director: game.director, cooldown: game.spitCooldown });
      setPaused(false); openUpgradeModal(); update(1);
      const upgradeFrozen = snapshot === JSON.stringify({ elapsed: game.elapsed, spit: spitter.spit, director: game.director, cooldown: game.spitCooldown });
      closeUpgradeModal(); update(0.79);
      const noEarlyShot = game.enemyProjectiles.length === 0;
      update(0.01);
      const fired = game.enemyProjectiles.length === 1;
      game.zombies.length = 0;
      const projectile = game.enemyProjectiles[0];
      projectile.x = player.x - 20; projectile.y = player.y;
      const shield = player.shield;
      update(0.02);
      const damaged = player.shield === shield - 8 && game.enemyProjectiles.length === 0;
      const recordedDamage = window.__zombieRoomPlaytest.damageEvents.at(-1)?.source;

      player = setup();
      const incoming = { x: player.x - 19, y: player.y, vx: 170, vy: 0, r: 5, damage: 8, life: 2, type: 'spitter-projectile' };
      game.enemyProjectiles.push({ ...incoming });
      player.invuln = 1;
      update(0.02);
      const invulnConsumed = player.shield === 40 && game.enemyProjectiles.length === 0;
      game.enemyProjectiles.push({ ...incoming });
      activateDash(); update(0.02);
      const dashSafe = player.shield === 40;
      player.dashTimer = 0;
      game.enemyProjectiles.push({ ...incoming, x: room.x + 20 });
      spawnPickup(player.x, player.y); game.pickups.at(-1).type = 'nuke';
      update(1 / 60);
      const nukeCleared = game.enemyProjectiles.length === 0;

      player = setup();
      const first = makeSpitter(player.x - 150, player.y);
      const second = makeSpitter(player.x - 150, player.y + 30);
      game.zombies.push(first, second);
      update(1 / 60);
      const globallyLimited = game.zombies.filter(z => z.spit?.state === 'windup').length === 1;
      first.hp = 0.1;
      game.bullets.push({ x: first.x, y: first.y, vx: 0, vy: 0, r: 5, damage: 1, pierce: 1, life: 1 });
      update(1 / 60);
      const cancelled = !game.zombies.includes(first) && game.enemyProjectiles.length === 0;
      // A full projectile pool must prevent another windup and never overflow on launch.
      game.spitCooldown = 0;
      game.enemyProjectiles = Array.from({ length: 12 }, () => ({ ...incoming, x: room.x + 30, y: room.y + 20, vx: 0, life: 2 }));
      update(1 / 60);
      const poolBound = second.spit.state === 'idle' && game.enemyProjectiles.length === 12;

      setup(); game.elapsed = 75; game.wave = 4; game.director = createDirectorState(42);
      game.zombies = Array.from({ length: 89 }, (_, i) => ({ x: -1000 - i, y: -1000, r: 13, hp: 999, maxHp: 999, type: 'walker', speed: 0, damage: 11, walkTime: 0, hitFlash: 0, attackFlash: 0 }));
      game.spawnTimer = 0;
      update(1 / 60);
      const capWithBoss = game.zombies.length === 90 && game.zombies.filter(z => z.type === 'boss').length === 1;
      update(1 / 60);
      const stillCapped = game.zombies.length === 90;

      game.enemyProjectiles.push({ ...incoming });
      resetGame();
      const resetClean = game.enemyProjectiles.length === 0 && game.spitCooldown === 0 && game.director.recentDamage.length === 0 && game.director.recoveryUntil === 0 && game.director.reliefUntil === 0;
      player = setup(); player.hp = 5; player.shield = 0;
      game.enemyProjectiles.push({ ...incoming, x: player.x - 19, y: player.y });
      update(0.02);
      const projectileDeath = !game.running && player.hp === 0 && window.__zombieRoomPlaytest.deathCause === 'spitter-projectile' && window.__zombieRoomPlaytest.final.enemyProjectiles === 0;

      return { started, pauseFrozen, upgradeFrozen, noEarlyShot, fired, damaged, recordedDamage, invulnConsumed, dashSafe, nukeCleared, globallyLimited, cancelled, poolBound, capWithBoss, stillCapped, resetClean, projectileDeath };
    })()`);
    for (const [key, value] of Object.entries(result)) {
      if (key === 'recordedDamage') assert.equal(value, 'spitter-projectile');
      else assert.equal(value, true, key);
    }
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

// This is a synthetic controller, not evidence of human difficulty or enjoyment.
const simulateRun = `(async () => {
  const { game, room, input } = await import('./src/state.js');
  const entities = await import('./src/entities.js');
  const { recordPlaytestInput } = await import('./src/playtest.js');
  const preference = window.testProfile === 'mobility'
    ? ['path_mobility', 'ambush', 'phaseDrive', 'agility', 'crit', 'damage', 'rapidFire', 'multiShot', 'pierce', 'vitality', 'magnet']
    : ['path_scatter', 'choke', 'plasmaFlak', 'tesla', 'damage', 'rapidFire', 'multiShot', 'pierce', 'crit', 'agility', 'vitality', 'magnet'];
  const rank = id => preference.includes(id) ? preference.indexOf(id) : Infinity;
  let iterations = 0;
  while (window.__zombieRoomPlaytest.status === 'running' && iterations++ < 20000) {
    if (game.upgradeModalOpen) {
      const choices = entities.currentUpgradeChoices;
      const index = window.testProfile !== 'first-card' ? choices.reduce((best, choice, i) => rank(choice.id) < rank(choices[best].id) ? i : best, 0) : 0;
      entities.chooseUpgrade(index);
      continue;
    }
    const p = game.player;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      const x = p.x + dx * 45, y = p.y + dy * 45;
      const clearance = Math.min(x - room.x, room.x + room.w - x, y - room.y, room.y + room.h - y);
      let score = Math.min(clearance, 40) * 0.3;
      if (clearance < 18) score -= 500;
      for (const obstacle of room.obstacles) {
        const ox = Math.max(obstacle.x, Math.min(x, obstacle.x + obstacle.w));
        const oy = Math.max(obstacle.y, Math.min(y, obstacle.y + obstacle.h));
        if (Math.hypot(x - ox, y - oy) < 22) score -= 500;
      }
      for (const z of game.zombies) score -= Math.max(0, 110 - Math.hypot(x - z.x, y - z.y));
      for (const h of room.hazards) if (h.state !== 'dormant' && Math.hypot(x - h.x, y - h.y) < h.r + 20) score -= 100;
      const orb = game.orbs.reduce((nearest, o) => !nearest || Math.hypot(o.x-p.x,o.y-p.y) < Math.hypot(nearest.x-p.x,nearest.y-p.y) ? o : nearest, null);
      if (orb) score -= Math.hypot(x - orb.x, y - orb.y) * 0.12;
      score += dx * Math.cos(game.elapsed * 0.8) + dy * Math.sin(game.elapsed * 0.8);
      if (score > bestScore) { bestScore = score; best = { dx, dy }; }
    }
    Object.assign(input, { up: false, down: false, left: false, right: false, active: true, vx: best.dx, vy: best.dy });
    recordPlaytestInput(input);
    if (game.player.dashCooldown === 0 && game.zombies.some(z => Math.hypot(z.x-p.x,z.y-p.y) < 45)) entities.activateDash();
    window.advanceTime(100);
  }
  if (iterations >= 20000) throw new Error('Synthetic run failed to terminate.');
  return structuredClone(window.__zombieRoomPlaytest);
})()`;

test('three seeds compare builds, reproduce director/ranged events and exercise late stages', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const runs = [];
    let replayedRangedRun = false;
    const replayedPaths = new Set();
    for (const seed of [42, 160501, 202602]) {
      for (const profile of ['offense', 'first-card', 'mobility']) {
        await openManual(cdp, url, seed);
        await cdp.evaluate(`window.testProfile = ${JSON.stringify(profile)}`);
        const run = await cdp.evaluate(simulateRun);
        assert.equal(run.status, 'finished');
        assert.ok(['player-death', 'time-cap'].includes(run.outcome));
        assert.equal(run.eventsTruncated, false);
        const shots = run.directorEvents.filter(event => event.type === 'spit').length;
        runs.push({ seed, profile, outcome: run.outcome, seconds: run.final.elapsed, wave: run.final.wave, kills: run.final.kills, hp: run.final.player.hp, shield: run.final.player.shield, damageHits: run.damageEvents.length, shots, reliefs: run.directorEvents.filter(event => event.type === 'relief').length, upgrades: run.final.upgrades, build: run.final.build });
        if ((!replayedRangedRun && shots > 0) || (run.final.build.path && !replayedPaths.has(run.final.build.path))) {
          const check = await cdp.evaluate(`(() => {
            const source = structuredClone(window.__zombieRoomPlaytest);
            const old = { ...source, schemaVersion: 3 };
            const oldRejected = !window.__zombieRoomPlaytestTools.replay(old).ok;
            const versionRejected = !window.__zombieRoomPlaytestTools.replay({ ...source, appVersion: '3.5.7' }).ok;
            const started = window.__zombieRoomPlaytestTools.replay(source);
            if (!started.ok) throw new Error(started.reason);
            let attempts = 0;
            while (window.__zombieRoomPlaytest.status === 'running' && attempts++ < 3000) window.advanceTime(1000);
            return { oldRejected, versionRejected, comparison: window.__zombieRoomPlaytest.replayComparison };
          })()`);
          assert.equal(check.oldRejected, true);
          assert.equal(check.versionRejected, true);
          assert.ok(check.comparison, 'replay should finish');
          for (const [key, value] of Object.entries(check.comparison)) assert.equal(value, key === 'mismatchCount' ? 0 : true, key);
          replayedRangedRun ||= shots > 0;
          if (run.final.build.path) replayedPaths.add(run.final.build.path);
        }
      }
    }
    assert.equal(replayedPaths.size, 3, 'all three build paths must record and replay naturally');
    console.log('Synthetic balance samples (not human playtests): ' + JSON.stringify(runs));
    assert.equal(replayedRangedRun, true, 'at least one natural run must exercise recorded ranged attacks');
    // Controlled late fixtures verify caps and simulation safety, not survivability.
    for (const elapsed of [600, 1200]) {
      await openManual(cdp, url, 42, 0);
      const late = await cdp.evaluate(`(async () => {
        const { game } = await import('./src/state.js');
        const { UPGRADES, EVOLUTIONS, chooseUpgrade } = await import('./src/entities.js');
        const { getWavePlan } = await import('./src/wave-director.js');
        game.elapsed = ${elapsed};
        for (const upgrade of UPGRADES) while (upgrade.level(game.player) < upgrade.maxLevel) upgrade.apply(game.player);
        const { BUILD_PATHS } = await import('./src/builds.js');
        game.player.level = 8; BUILD_PATHS[0].apply(game.player);
        game.player.build.specialization = 'fork';
        EVOLUTIONS[0].apply(game.player);
        game.player.invuln = 100;
        const start = performance.now();
        let peakEnemies = 0, peakProjectiles = 0;
        for (let frame = 0; frame < 1800; frame++) {
          if (game.upgradeModalOpen) chooseUpgrade(0);
          window.advanceTime(1000 / 60);
          peakEnemies = Math.max(peakEnemies, game.zombies.length);
          peakProjectiles = Math.max(peakProjectiles, game.enemyProjectiles.length);
        }
        return { wave: game.wave, healthScale: getWavePlan(42, game.wave).healthScale, elapsed: game.elapsed, peakEnemies, peakProjectiles, cpuMs: performance.now() - start };
      })()`);
      assert.ok(late.elapsed >= elapsed + 29);
      assert.ok(late.peakEnemies <= 90);
      assert.ok(late.peakProjectiles <= 12);
      console.log('Controlled late fixture: ' + JSON.stringify(late));
    }
    await openManual(cdp, url, 987, 0);
    const stress = await cdp.evaluate(`(async () => {
      const { game, room } = await import('./src/state.js');
      const { createDirectorState } = await import('./src/wave-director.js');
      game.elapsed = 1200; game.director = createDirectorState(987);
      game.player.invuln = 100; game.player.shootTimer = 100;
      room.hazards = []; room.obstacles = [];
      let peakEnemies = 0, peakSpitters = 0, peakProjectiles = 0;
      const start = performance.now();
      for (let sample = 0; sample < 600; sample++) {
        window.advanceTime(100);
        peakEnemies = Math.max(peakEnemies, game.zombies.length);
        peakSpitters = Math.max(peakSpitters, game.zombies.filter(z => z.type === 'spitter').length);
        peakProjectiles = Math.max(peakProjectiles, game.enemyProjectiles.length);
      }
      return { peakEnemies, peakSpitters, peakProjectiles, cpuMs: performance.now() - start };
    })()`);
    assert.ok(stress.peakEnemies >= 80 && stress.peakEnemies <= 90);
    assert.ok(stress.peakSpitters > 0 && stress.peakSpitters <= 4);
    assert.ok(stress.peakProjectiles <= 12);
    console.log('Controlled saturation fixture: ' + JSON.stringify(stress));
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

test('PWA precaches combat/build modules and starts offline', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await cdp.send('Page.navigate', { url });
    await waitFor(cdp.evaluate.bind(cdp), 'Boolean(navigator.serviceWorker.controller)', Boolean);
    const cached = await cdp.evaluate(`(async () => {
      await navigator.serviceWorker.ready;
      return { caches: await caches.keys(), ranged: Boolean(await caches.match('./src/ranged-combat.js')), builds: Boolean(await caches.match('./src/builds.js')) };
    })()`);
    assert.ok(cached.caches.includes('zombie-room-v3.7.0'));
    assert.equal(cached.ranged, true);
    assert.equal(cached.builds, true);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await cdp.send('Network.clearBrowserCache');
    // A hard reload bypasses service workers; a normal offline navigation must use the shell cache.
    await cdp.send('Page.reload', { ignoreCache: false });
    const offline = await waitFor(cdp.evaluate.bind(cdp), `(async () => {
      const { APP_VERSION, game } = await import('./src/state.js');
      return { version: APP_VERSION, running: game.running, hasDirector: Boolean(game.director), offline: !navigator.onLine };
    })()`, value => value?.hasDirector);
    assert.deepEqual(offline, { version: '3.7.0', running: true, hasDirector: true, offline: true });
    assert.deepEqual(cdp.runtimeExceptions, []);
  }, { serviceWorker: true });
});

test('legacy best scores survive and all seven locales refresh while paused', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await openManual(cdp, url);
    await cdp.evaluate("localStorage.setItem('zombie-room-best', '999999'); localStorage.removeItem('zombie-room-best-version')");
    await openManual(cdp, url);
    assert.equal(await cdp.evaluate("document.querySelector('#bestText').textContent"), '999999*');
    await cdp.evaluate("document.querySelector('#settingsTrigger').click()");
    for (const [locale, expected] of [['en', 'BUILDUP'], ['zh', '升温'], ['ms', 'PEMANASAN'], ['ja', '助走'], ['ko', '준비'], ['vi', 'KHỞI ĐỘNG'], ['th', 'เริ่มกดดัน']]) {
      const translated = await cdp.evaluate(`(() => {
        const select = document.querySelector('#languageSelect');
        select.value = ${JSON.stringify(locale)}; select.dispatchEvent(new Event('change', { bubbles: true }));
        return { encounter: document.querySelector('#encounterText').textContent, label: document.querySelector('#waveText').getAttribute('aria-label'), note: document.querySelector('#legacyBestNote').textContent, noteHidden: document.querySelector('#legacyBestNote').hidden, overflow: document.documentElement.scrollWidth > innerWidth };
      })()`);
      assert.equal(translated.encounter, expected);
      assert.ok(translated.label.includes(expected) && !translated.label.includes('{'));
      assert.ok(translated.note.includes('v3.7'));
      assert.equal(translated.noteHidden, false);
      assert.equal(translated.overflow, false);
    }
    const newBest = await cdp.evaluate(`(async () => {
      const { game, room } = await import('./src/state.js');
      const { resetGame, update } = await import('./src/entities.js');
      resetGame(); room.obstacles = []; room.hazards = [];
      game.score = 1000000; game.player.hp = 1; game.player.shield = 0;
      game.enemyProjectiles.push({ x: game.player.x, y: game.player.y, r: 5, vx: 0, vy: 0, damage: 8, life: 1, type: 'spitter-projectile' });
      update(1 / 60);
      return { best: localStorage.getItem('zombie-room-best'), version: localStorage.getItem('zombie-room-best-version'), text: document.querySelector('#bestText').textContent, hidden: document.querySelector('#legacyBestNote').hidden };
    })()`);
    assert.deepEqual(newBest, { best: '1000000', version: '3.7.0', text: '1000000', hidden: true });
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

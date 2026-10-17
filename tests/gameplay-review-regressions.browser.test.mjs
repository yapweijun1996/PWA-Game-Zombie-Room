import assert from 'node:assert/strict';
import test from 'node:test';
import { withBrowser, waitFor, requireBrowser, skipReason } from './browser-harness.mjs';

const browserOptions = { skip: requireBrowser ? false : skipReason, timeout: 45000 };

async function openManual(cdp, url) {
  await cdp.send('Page.navigate', { url: `${url}/?playtestSeed=42&playtestManual=1&playtestLimit=0` });
  await waitFor(cdp.evaluate.bind(cdp), 'typeof window.advanceTime === "function"', Boolean);
}

test('cover routing, ordered bullet impacts, queued upgrades, lethal hazards, and blackout supplies', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await openManual(cdp, url);
    const result = await cdp.evaluate(`(async () => {
      const { game, room, input } = await import('./src/state.js');
      const { resetGame, update, openUpgradeModal, chooseUpgrade, UPGRADES } = await import('./src/entities.js');
      const { createDirectorState } = await import('./src/wave-director.js');
      const setup = () => {
        resetGame();
        room.obstacles = []; room.hazards = [];
        Object.assign(input, { up: false, down: false, left: false, right: false, active: false, vx: 0, vy: 0 });
        game.director = createDirectorState(game.scenarioSeed);
        game.spawnTimer = 100;
        game.player.shootTimer = 100;
        game.player.invuln = 100;
        return game.player;
      };

      let player = setup();
      const centerY = room.y + room.h * 0.5;
      const pillar = { x: room.x + 130, y: centerY - 20, w: 46, h: 40 };
      room.obstacles = [pillar];
      player.x = room.x + 300; player.y = centerY;
      const walker = { x: room.x + 80, y: centerY, r: 13, type: 'walker', hp: 999, maxHp: 999, speed: 50, damage: 0, color: '#79b86a', xp: 1, score: 10, hitFlash: 0, attackFlash: 0, walkTime: 0, facing: 0, affix: null };
      game.zombies.push(walker);
      let routedPastPillar = false;
      let maxDeviation = 0;
      for (let i = 0; i < 480; i++) {
        update(1 / 60);
        routedPastPillar ||= walker.x > pillar.x + pillar.w;
        maxDeviation = Math.max(maxDeviation, Math.abs(walker.y - centerY));
      }
      routedPastPillar &&= maxDeviation > 15;

      player = setup();
      player.x = room.x + 50; player.y = room.y + 120;
      const wall = { x: player.x + 90, y: player.y - 20, w: 24, h: 40 };
      room.obstacles = [wall];
      const front = { x: player.x + 55, y: player.y, r: 13, type: 'walker', hp: 100, maxHp: 100, speed: 0, damage: 0, color: '#79b86a', xp: 1, score: 10, hitFlash: 0, attackFlash: 0, walkTime: 0, affix: null };
      game.zombies.push(front);
      game.bullets.push({ x: player.x, y: player.y, vx: 460, vy: 0, r: 3.5, damage: 1, pierce: 1, life: 1, hitTargets: new Set() });
      update(0.25);
      const targetBeforeCoverHit = front.hp === 99;

      player = setup();
      player.x = room.x + 50; player.y = room.y + 120;
      room.obstacles = [{ x: player.x + 90, y: player.y - 20, w: 24, h: 40 }];
      const behind = { x: player.x + 160, y: player.y, r: 13, type: 'walker', hp: 100, maxHp: 100, speed: 0, damage: 0, color: '#79b86a', xp: 1, score: 10, hitFlash: 0, attackFlash: 0, walkTime: 0, affix: null };
      game.zombies.push(behind);
      game.bullets.push({ x: player.x, y: player.y, vx: 460, vy: 0, r: 3.5, damage: 1, pierce: 1, life: 1, hitTargets: new Set() });
      update(0.5);
      const coverBeforeTargetBlocked = behind.hp === 100 && game.bullets.length === 0;

      player = setup();
      player.hp = 10; player.maxHp = 100; player.level = 1;
      player.upgrades = { multiShot: 3, rapidFire: 5, damage: 5, pierce: 3, vitality: 5, agility: 4, magnet: 2, crit: 3 };
      player.projectiles = 3;
      game.pendingUpgrades = 3;
      openUpgradeModal();
      const oneChoiceRemains = game.upgradeModalOpen && document.querySelectorAll('#upgradeCards button').length === 1;
      chooseUpgrade(0);
      const queuedFallbacksPaid = !game.upgradeModalOpen && game.pendingUpgrades === 0 && player.hp === 60;
      player.hp = 10; player.upgrades.magnet = 3; game.pendingUpgrades = 3;
      openUpgradeModal();
      const exhaustedQueuePaid = !game.upgradeModalOpen && game.pendingUpgrades === 0 && player.hp === 85;

      player = setup();
      player.hp = 5; player.shield = 0; player.invuln = 0;
      const firstHazard = { x: player.x, y: player.y, r: 30, state: 'active', timer: 0, tickTimer: 0 };
      const laterHazard = { x: player.x + 100, y: player.y, r: 30, state: 'active', timer: 0, tickTimer: 0 };
      room.hazards = [firstHazard, laterHazard];
      const untouchedLaterTimer = laterHazard.timer;
      update(1 / 60);
      const lethalHazardStopsStep = !game.running && game.score === 0 && laterHazard.timer === untouchedLaterTimer;

      const blackoutCounts = [];
      for (const existingCount of [0, 7, 8]) {
        player = setup();
        player.x = room.x + 28; player.y = room.y + room.h - 28;
        game.blackoutTimer = 0.01;
        game.pickups = Array.from({ length: existingCount }, (_, index) => ({
          x: room.x + 24 + index * 8, y: room.y + 24, type: 'magnet', life: 8, pulse: 0
        }));
        update(0.02);
        blackoutCounts.push(game.pickups.filter(item => item.life > 15.9).length);
        if (game.pickups.length > 8) throw new Error('pickup capacity exceeded');
      }
      return { routedPastPillar, targetBeforeCoverHit, coverBeforeTargetBlocked, oneChoiceRemains, queuedFallbacksPaid, exhaustedQueuePaid, lethalHazardStopsStep, blackoutCounts };
    })()`);
    assert.equal(result.routedPastPillar, true, JSON.stringify(result));
    assert.equal(result.targetBeforeCoverHit, true, JSON.stringify(result));
    assert.equal(result.coverBeforeTargetBlocked, true, JSON.stringify(result));
    assert.equal(result.oneChoiceRemains, true, JSON.stringify(result));
    assert.equal(result.queuedFallbacksPaid, true, JSON.stringify(result));
    assert.equal(result.exhaustedQueuePaid, true, JSON.stringify(result));
    assert.equal(result.lethalHazardStopsStep, true, JSON.stringify(result));
    assert.deepEqual(result.blackoutCounts, [2, 2, 2]);
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

test('short viewports, Settings keyboard focus, clipboard feedback, and translations remain correct', browserOptions, async () => {
  await withBrowser(async (cdp, url) => {
    await openManual(cdp, url);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 320, deviceScaleFactor: 1, mobile: false });
    const visible = await waitFor(cdp.evaluate.bind(cdp), `import('./src/state.js').then(({ viewport }) => viewport.H)`, value => value === 320);
    assert.equal(visible, 320);
    const roomBounds = await cdp.evaluate(`import('./src/state.js').then(({ game, room, viewport }) => ({
      viewport: viewport.H, bottom: room.y + room.h, playerBottom: game.player.y + game.player.r
    }))`);
    assert.ok(roomBounds.bottom <= roomBounds.viewport, JSON.stringify(roomBounds));
    assert.ok(roomBounds.playerBottom <= roomBounds.viewport, JSON.stringify(roomBounds));

    const keyboard = await cdp.evaluate(`(async () => {
      const { input } = await import('./src/state.js');
      document.querySelector('#settingsTrigger').click();
      const language = document.querySelector('#languageSelect'); language.focus();
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
      language.dispatchEvent(event);
      const result = { defaultPrevented: event.defaultPrevented, movement: input.up || input.down || input.left || input.right };
      document.querySelector('#settingsTrigger').click();
      return result;
    })()`);
    assert.deepEqual(keyboard, { defaultPrevented: false, movement: false });

    const shareAndLocale = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { resetGame, UPGRADES } = await import('./src/entities.js');
      const { showGameOver } = await import('./src/game-ui.js');
      const { SUPPORTED_LOCALES, setLocale, t } = await import('./src/i18n.js');
      resetGame();
      const player = game.player;
      player.upgrades = { multiShot: 3, rapidFire: 5, damage: 5, pierce: 3, vitality: 5, agility: 4, magnet: 3, crit: 3 };
      player.projectiles = 3;
      showGameOver({ score: 0, combo: 0, wave: 1, kills: 0, elapsed: 0, isNewBest: false, rank: 'C', player, upgrades: UPGRADES, performanceMode: false });
      const maxLevelLabel = document.querySelector('.build-chip-level')?.textContent;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
      document.querySelector('#shareButton').click();
      const missingClipboardFeedback = document.querySelector('#message').textContent;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } });
      document.querySelector('#shareButton').click();
      await new Promise(resolve => setTimeout(resolve, 0));
      const rejectedClipboardFeedback = document.querySelector('#message').textContent;
      const translations = {};
      for (const locale of SUPPORTED_LOCALES) {
        setLocale(locale);
        translations[locale] = { max: t('upgradeMaxLevel'), failed: t('shareFailed') };
      }
      setLocale('en');
      return { maxLevelLabel, missingClipboardFeedback, rejectedClipboardFeedback, translations };
    })()`);
    assert.equal(shareAndLocale.maxLevelLabel, 'MAX');
    assert.match(shareAndLocale.missingClipboardFeedback, /COULD NOT COPY RUN SUMMARY/);
    assert.match(shareAndLocale.rejectedClipboardFeedback, /COULD NOT COPY RUN SUMMARY/);
    for (const [locale, values] of Object.entries(shareAndLocale.translations)) {
      assert.notEqual(values.max, 'upgradeMaxLevel', locale);
      assert.notEqual(values.failed, 'shareFailed', locale);
    }
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

test('first-card no-Dash movement runs create pressure without making every seed fail early', { ...browserOptions, timeout: 90000 }, async () => {
  await withBrowser(async (cdp, url) => {
    const scenarios = [
      { width: 1200, height: 685, mobile: false, seed: 42 },
      { width: 1200, height: 685, mobile: false, seed: 160501 },
      { width: 1200, height: 685, mobile: false, seed: 202602 },
      { width: 390, height: 844, mobile: true, seed: 42 },
      { width: 390, height: 844, mobile: true, seed: 160501 },
      { width: 390, height: 844, mobile: true, seed: 202602 }
    ];
    const outcomes = [];
    for (const scenario of scenarios) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: scenario.width, height: scenario.height, deviceScaleFactor: 1, mobile: scenario.mobile
      });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: scenario.mobile, maxTouchPoints: 1 });
      await cdp.send('Page.navigate', { url: `${url}/?playtestSeed=${scenario.seed}&playtestManual=1&playtestLimit=300` });
      await waitFor(cdp.evaluate.bind(cdp), 'Boolean(window.__zombieRoomPlaytestTools)', Boolean);
      const outcome = await cdp.evaluate(`(async () => {
        const { game, input } = await import('./src/state.js');
        const { chooseUpgrade } = await import('./src/entities.js');
        let steps = 0;
        while (game.running && game.elapsed < 301 && steps++ < 4000) {
          if (game.upgradeModalOpen) {
            chooseUpgrade(0);
            continue;
          }
          const direction = Math.floor(game.elapsed) % 4;
          Object.assign(input, {
            up: direction === 3, right: direction === 0,
            down: direction === 1, left: direction === 2,
            active: false, vx: 0, vy: 0
          });
          window.advanceTime(100);
        }
        const run = window.__zombieRoomPlaytest;
        return { elapsed: run.final.elapsed, hp: run.final.player.hp, shield: run.final.player.shield, outcome: run.outcome, steps };
      })()`);
      outcomes.push({ viewport: `${scenario.width}x${scenario.height}`, seed: scenario.seed, ...outcome });
      assert.ok(outcome.steps < 4000, `run failed to terminate: ${JSON.stringify(outcome)}`);
      assert.ok(outcome.elapsed >= 10, `run ended implausibly early: ${JSON.stringify(outcome)}`);
      assert.deepEqual(cdp.runtimeExceptions, []);
    }
    const survivors = outcomes.filter(run => run.elapsed >= 300).length;
    const pressured = outcomes.filter(run => run.elapsed < 300).length;
    console.log('First-card no-Dash balance samples (not human playtests): ' + JSON.stringify(outcomes));
    assert.ok(survivors > 0, 'at least one seed should remain survivable');
    assert.ok(pressured > 0, 'the no-Dash policy should experience lethal pressure on some seeds');
  });
});

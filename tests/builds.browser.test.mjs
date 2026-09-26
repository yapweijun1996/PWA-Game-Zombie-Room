import assert from 'node:assert/strict';
import test from 'node:test';
import { withBrowser, waitFor, requireBrowser, skipReason, sendKey } from './browser-harness.mjs';

const options = { skip: requireBrowser ? false : skipReason, timeout: 90000 };
async function open(cdp, url) {
  await cdp.send('Page.navigate', { url: `${url}/?playtestSeed=42&playtestManual=1&playtestLimit=0` });
  await waitFor(cdp.evaluate.bind(cdp), 'typeof window.advanceTime === "function"', Boolean);
}

test('build combat applies arcs, single-hit piercing, scatter knockback and timed Dash bursts', options, async () => {
  await withBrowser(async (cdp, url) => {
    await open(cdp, url);
    const result = await cdp.evaluate(`(async () => {
      const { game, room } = await import('./src/state.js');
      const { resetGame, update, activateDash, setPaused, openUpgradeModal, closeUpgradeModal } = await import('./src/entities.js');
      const { BUILD_PATHS, getBuildProfile } = await import('./src/builds.js');
      const enemy = (x, y) => ({ x, y, r: 13, hp: 100, maxHp: 100, type: 'walker', speed: 0, damage: 11, score: 10, xp: 1, color: '#79b86a', walkTime: 0, hitFlash: 0, attackFlash: 0 });
      const setup = path => {
        resetGame(); room.obstacles = []; room.hazards = [];
        game.spawnTimer = 100;
        const p = game.player; p.level = 4; p.x = room.x + 100; p.y = room.y + 100;
        BUILD_PATHS.find(choice => choice.path === path).apply(p);
        return p;
      };
      let p = setup('arc'); p.pierce = 3;
      const target = enemy(p.x + 50, p.y), nearby = enemy(p.x + 60, p.y + 50), distant = enemy(p.x + 60, p.y + 190);
      game.zombies.push(target, nearby, distant);
      update(0);
      const bullet = game.bullets[0]; bullet.x = target.x; bullet.y = target.y; bullet.vx = 0; bullet.vy = 0;
      update(0.01);
      const firstHit = { target: target.hp, nearby: nearby.hp, distant: distant.hp };
      update(0.01);
      const secondHit = { target: target.hp, nearby: nearby.hp, distant: distant.hp };
      const arcs = game.particles.filter(particle => particle.shape === 'arc');
      const arc = { firstHit, secondHit, remainingPierce: bullet.pierce, visibleArcs: arcs.length, finiteArcs: arcs.every(particle => Number.isFinite(particle.x) && Number.isFinite(particle.y)) };

      p = setup('scatter');
      const pushed = enemy(p.x + 70, p.y);
      game.zombies.push(pushed); update(0);
      const volley = game.bullets.map(b => ({ damage: b.damage, life: b.life, vy: b.vy }));
      const pellet = game.bullets[1]; game.bullets = [pellet];
      pellet.x = pushed.x; pellet.y = pushed.y;
      update(0);
      const scatter = { volley, displacement: pushed.x - (p.x + 70), hp: pushed.hp };

      p = setup('mobility'); p.build.specialization = 'ambush'; p.superWeapons.phaseDrive = true;
      game.zombies.push(enemy(p.x + 100, p.y));
      const dashStarted = activateDash(false, { x: 1, y: 0 }); update(0);
      const burst = { timer: p.build.burstTimer, cooldown: p.dashCooldown, max: p.dashCooldownMax, damage: game.bullets[0].damage, pierce: game.bullets[0].pierce, interval: p.shootTimer };
      const before = JSON.stringify({ build: p.build, cooldown: p.dashCooldown, elapsed: game.elapsed });
      setPaused(true); update(1);
      const paused = before === JSON.stringify({ build: p.build, cooldown: p.dashCooldown, elapsed: game.elapsed });
      setPaused(false); openUpgradeModal(); update(1);
      const modal = before === JSON.stringify({ build: p.build, cooldown: p.dashCooldown, elapsed: game.elapsed });
      closeUpgradeModal();
      game.zombies.length = 0; game.bullets.length = 0; game.director.recoveryUntil = 10;
      for (let i = 0; i < 181; i++) update(1 / 60);
      const expired = { timer: p.build.burstTimer, profile: getBuildProfile(p) };
      resetGame();
      const reset = { build: game.player.build, evolutions: game.player.superWeapons, cooldown: game.player.dashCooldownMax };
      return { arc, scatter, dashStarted, burst, paused, modal, expired, reset };
    })()`);
    assert.deepEqual(result.arc.firstHit, result.arc.secondHit, 'piercing cannot repeat damage while overlapping');
    assert.ok(Math.abs(result.arc.firstHit.target - 99.15) < 1e-9);
    assert.ok(Math.abs(result.arc.firstHit.nearby - (100 - 0.85 * 0.55)) < 1e-9);
    assert.equal(result.arc.firstHit.distant, 100);
    assert.equal(result.arc.remainingPierce, 2);
    assert.equal(result.arc.visibleArcs, 1);
    assert.equal(result.arc.finiteArcs, true, 'arc visual endpoints must survive particle integration');
    assert.equal(result.scatter.volley.length, 3);
    assert.ok(result.scatter.volley[0].vy < 0 && result.scatter.volley[2].vy > 0);
    assert.equal(result.scatter.volley[1].life, 0.55);
    assert.equal(result.scatter.displacement, 16);
    assert.equal(result.scatter.hp, 99.35);
    assert.equal(result.dashStarted, true);
    assert.equal(result.burst.timer, 3);
    assert.equal(result.burst.cooldown, 6);
    assert.equal(result.burst.max, 6);
    assert.equal(result.burst.damage, 0.85 * 1.6);
    assert.equal(result.burst.pierce, 3);
    assert.equal(result.burst.interval, 0.38 * 0.65);
    assert.equal(result.paused, true);
    assert.equal(result.modal, true);
    assert.equal(result.expired.timer, 0);
    assert.equal(result.expired.profile.damage, 0.85);
    assert.equal(result.expired.profile.pierce, 1);
    assert.deepEqual(result.reset.build, { path: null, specialization: null, burstTimer: 0 });
    assert.ok(Object.values(result.reset.evolutions).every(value => value === false));
    assert.equal(result.reset.cooldown, 8);
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

test('build choice queues, keyboard/touch selection, seven locales and bounded modal scrolling', options, async () => {
  await withBrowser(async (cdp, url) => {
    await open(cdp, url);
    await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { openUpgradeModal } = await import('./src/entities.js');
      game.player.level = 8; game.pendingUpgrades = 3; openUpgradeModal();
    })()`);
    await sendKey(cdp, 'keydown', '3');
    const first = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      const { currentUpgradeChoices } = await import('./src/entities.js');
      return { path: game.player.build.path, pending: game.pendingUpgrades, choices: currentUpgradeChoices.map(c => c.id), hint: document.querySelector('.upgrade-keyboard-hint').textContent };
    })()`);
    assert.equal(first.path, 'mobility');
    assert.equal(first.pending, 2);
    assert.deepEqual(first.choices, ['slipstream', 'ambush']);
    assert.ok(first.hint.includes('1 / 2') && !first.hint.includes('3'));
    await sendKey(cdp, 'keydown', '3');
    assert.equal(await cdp.evaluate("import('./src/state.js').then(({game}) => game.pendingUpgrades)"), 2);
    await sendKey(cdp, 'keydown', '2');
    await sendKey(cdp, 'keydown', '1');
    const queued = await cdp.evaluate(`(async () => {
      const { game } = await import('./src/state.js');
      return { build: game.player.build, pending: game.pendingUpgrades, open: game.upgradeModalOpen, events: window.__zombieRoomPlaytest.upgrades.map(e => e.id) };
    })()`);
    assert.equal(queued.build.specialization, 'ambush');
    assert.equal(queued.pending, 0);
    assert.equal(queued.open, false);
    assert.deepEqual(queued.events.slice(0, 2), ['path_mobility', 'ambush']);
    assert.equal(queued.events.length, 3);

    let observedScroll = false;
    for (const [width, height] of [[320, 568], [390, 844], [844, 390], [667, 320], [1280, 720]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: width < 900, maxTouchPoints: 1 });
      for (const locale of ['en', 'zh', 'ms', 'ja', 'ko', 'vi', 'th']) {
        const layout = await cdp.evaluate(`(async () => {
          const { game } = await import('./src/state.js');
          const { resetGame, openUpgradeModal, currentUpgradeChoices } = await import('./src/entities.js');
          const { t } = await import('./src/i18n.js');
          const { BUILD_PATHS, BUILD_SPECIALIZATIONS, BUILD_EVOLUTIONS } = await import('./src/builds.js');
          resetGame(); game.player.level = 4; game.pendingUpgrades = 1; openUpgradeModal();
          const select = document.querySelector('#languageSelect'); select.value = ${JSON.stringify(locale)}; select.dispatchEvent(new Event('change'));
          const modal = document.querySelector('#upgradeModal'), cards = document.querySelector('#upgradeCards');
          const rect = modal.getBoundingClientRect();
          const title = modal.querySelector('.upgrade-title');
          const titleTop = title.getBoundingClientRect().top;
          const positions = [0, cards.scrollHeight / 2, cards.scrollHeight].map(top => {
            cards.scrollTop = top;
            return { scroll: cards.scrollTop, titleTop: title.getBoundingClientRect().top, outerScroll: modal.scrollTop };
          });
          const translated = [...BUILD_PATHS, ...BUILD_SPECIALIZATIONS, ...BUILD_EVOLUTIONS].every(c => t(c.titleKey) !== c.titleKey && t(c.descKey) !== c.descKey);
          const buttons = [...cards.querySelectorAll('button')];
          const last = buttons.at(-1).getBoundingClientRect(), area = cards.getBoundingClientRect();
          buttons.at(-1).focus();
          const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }); document.dispatchEvent(tab);
          const focused = buttons[0].getBoundingClientRect();
          return { width: innerWidth, pageWidth: document.documentElement.scrollWidth, modalWidth: modal.clientWidth, scrollWidth: modal.scrollWidth,
            top: rect.top, bottom: rect.bottom, titleTop, positions, translated, lastVisible: last.bottom <= area.bottom + 1,
            topLayer: Number(getComputedStyle(modal.parentElement).zIndex) > Math.max(...['#appbar', '#message', '#controlsWrap'].map(selector => Number(getComputedStyle(document.querySelector(selector)).zIndex))),
            focusVisible: focused.top >= area.top - 1 && focused.bottom <= area.bottom + 1,
            minimumButton: Math.min(...buttons.map(b => b.getBoundingClientRect().height)), focusWrapped: document.activeElement === buttons[0] };
        })()`);
        observedScroll ||= layout.positions.some(position => position.scroll > 0);
        assert.equal(layout.pageWidth, width, `${locale} ${width}: page overflow`);
        assert.ok(layout.scrollWidth <= layout.modalWidth + 1, `${locale} ${width}: modal overflow`);
        assert.ok(layout.top >= 0 && layout.bottom <= height + 1, `${locale} ${width}: modal outside viewport`);
        assert.ok(layout.positions.every(position => position.outerScroll === 0 && position.titleTop === layout.titleTop));
        assert.equal(layout.lastVisible, true, `${locale} ${width}: final choice unreachable`);
        assert.equal(layout.translated, true);
        assert.equal(layout.topLayer, true, `${locale} ${width}: HUD or messages cover the dialog`);
        assert.ok(layout.minimumButton >= 44);
        assert.equal(layout.focusWrapped, true);
        assert.equal(layout.focusVisible, true, `${locale} ${width}: keyboard focus is clipped`);
      }
      // Use an actual touch or mouse event to close the choice dialog.
      const point = await cdp.evaluate(`(() => { const r = document.querySelector('#upgradeCards button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (width < 900) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
        await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
      }
      await waitFor(cdp.evaluate.bind(cdp), "document.querySelector('#upgradeModal').hidden", Boolean);
      const indicatorVisible = await cdp.evaluate(`(() => {
        const icon = document.querySelector('#buildPathIcon');
        const r = icon.getBoundingClientRect(), label = icon.parentElement.getBoundingClientRect();
        return !icon.hidden && r.width > 0 && r.left >= label.left - 1 && r.right <= label.right + 1;
      })()`);
      assert.equal(indicatorVisible, true, `${width}: build indicator is clipped`);
    }
    assert.equal(observedScroll, true, 'short landscape must exercise actual card scrolling');
    assert.deepEqual(cdp.runtimeExceptions, []);
  });
});

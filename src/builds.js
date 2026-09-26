// Build choices and derived combat stats share one source of truth.
export const BUILD_CONFIG = Object.freeze({ pathLevel: 4, specializationLevel: 8 });

export function createBuildState() {
  return { path: null, specialization: null, burstTimer: 0 };
}

function pathChoice(path, icon) {
  return Object.freeze({
    id: 'path_' + path, path, icon, isBuild: true,
    titleKey: 'path_' + path, descKey: 'path_' + path + '_desc',
    apply(player) {
      if (player.level < BUILD_CONFIG.pathLevel || player.build?.path) return false;
      player.build = { ...createBuildState(), path };
      return true;
    }
  });
}

function specializationChoice(id, path, icon) {
  return Object.freeze({
    id, path, icon, isBuild: true, isSpecialization: true,
    titleKey: id, descKey: id + '_desc',
    apply(player) {
      if (player.level < BUILD_CONFIG.specializationLevel || player.build?.path !== path || player.build.specialization) return false;
      player.build.specialization = id;
      return true;
    }
  });
}

export const BUILD_PATHS = Object.freeze([
  pathChoice('arc', 'ϟ'), pathChoice('scatter', '✹'), pathChoice('mobility', '➤')
]);

export const BUILD_SPECIALIZATIONS = Object.freeze([
  specializationChoice('fork', 'arc', '⑂'),
  specializationChoice('conductor', 'arc', '⌁'),
  specializationChoice('choke', 'scatter', '⊕'),
  specializationChoice('concussion', 'scatter', '✺'),
  specializationChoice('slipstream', 'mobility', '»'),
  specializationChoice('ambush', 'mobility', '◇')
]);

export function getBuildChoices(player) {
  if (!player.build?.path && player.level >= BUILD_CONFIG.pathLevel) return [...BUILD_PATHS];
  if (player.build?.path && !player.build.specialization && player.level >= BUILD_CONFIG.specializationLevel) {
    return BUILD_SPECIALIZATIONS.filter(choice => choice.path === player.build.path);
  }
  return [];
}

export function getBuildProfile(player) {
  const path = player.build?.path;
  const specialization = player.build?.specialization;
  const evolved = player.superWeapons || {};
  const bursting = path === 'mobility' && player.build.burstTimer > 0;
  const profile = {
    damage: player.damage, fireRate: player.fireRate,
    projectiles: player.projectiles || 1, spread: 0.16, life: 1.35,
    pierce: player.pierce || 1, knockback: 0,
    chainTargets: 0, chainRange: 110, chainDamage: 0,
    dashCooldown: 8, burstDuration: 0, bursting
  };
  if (path === 'arc') {
    profile.damage *= 0.85;
    profile.chainTargets = evolved.tesla ? 3 : 1;
    profile.chainDamage = evolved.tesla ? 0.75 : 0.55;
    if (specialization === 'fork') {
      profile.chainTargets += 2;
      profile.chainDamage *= 0.65;
    } else if (specialization === 'conductor') {
      profile.chainRange = 160;
      profile.fireRate *= 1.15;
    }
  } else if (path === 'scatter') {
    profile.damage *= 0.65;
    profile.projectiles += 2;
    profile.spread = 0.22;
    profile.life = 0.55;
    profile.knockback = evolved.plasmaFlak ? 36 : 16;
    if (evolved.plasmaFlak) profile.projectiles += 2;
    if (specialization === 'choke') {
      profile.projectiles--;
      profile.spread = 0.10;
      profile.life = 0.85;
    } else if (specialization === 'concussion') {
      profile.knockback *= 1.7;
      profile.damage *= 0.85;
    }
  } else if (path === 'mobility') {
    profile.damage *= 0.85;
    profile.dashCooldown = specialization === 'slipstream' ? 4 : specialization === 'ambush' ? 6 : 5;
    profile.burstDuration = (specialization === 'slipstream' ? 1.2 : 2) + (evolved.phaseDrive ? 1 : 0);
    if (bursting) {
      profile.fireRate *= 0.65;
      if (specialization === 'ambush') profile.damage *= 1.6;
      if (evolved.phaseDrive) profile.pierce += 2;
    }
  }
  return profile;
}

export const BUILD_EVOLUTIONS = Object.freeze([
  Object.freeze({
    id: 'tesla', path: 'arc', icon: '⚡', titleKey: 'evoTeslaTitle', descKey: 'evoTeslaDesc', isEvolution: true,
    requirements: Object.freeze({ multiShot: 3, pierce: 3 })
  }),
  Object.freeze({
    id: 'plasmaFlak', path: 'scatter', icon: '💥', titleKey: 'evoPlasmaTitle', descKey: 'evoPlasmaDesc', isEvolution: true,
    requirements: Object.freeze({ damage: 3, rapidFire: 3 })
  }),
  Object.freeze({
    id: 'phaseDrive', path: 'mobility', icon: '➤', titleKey: 'evoPhaseTitle', descKey: 'evoPhaseDesc', isEvolution: true,
    requirements: Object.freeze({ agility: 2, crit: 2 })
  })
]);

export function canUnlockEvolution(player, evolution) {
  return player.build?.path === evolution.path && !player.superWeapons?.[evolution.id] &&
    Object.entries(evolution.requirements).every(([id, level]) => (player.upgrades[id] || 0) >= level);
}

export function applyEvolution(player, evolution) {
  if (!canUnlockEvolution(player, evolution)) return false;
  player.superWeapons[evolution.id] = true;
  return true;
}

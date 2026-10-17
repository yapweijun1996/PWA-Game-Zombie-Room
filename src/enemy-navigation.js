const EPSILON = 0.5;

function segmentIntersectsBox(from, to, box) {
  let enter = 0;
  let leave = 1;
  for (const [start, end, min, max] of [
    [from.x, to.x, box.x, box.x + box.w],
    [from.y, to.y, box.y, box.y + box.h]
  ]) {
    const delta = end - start;
    if (Math.abs(delta) < 1e-9) {
      if (start < min || start > max) return false;
      continue;
    }
    const a = (min - start) / delta;
    const b = (max - start) / delta;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (enter >= leave) return false;
  }
  return leave > 0 && enter < 1;
}

function clearSegment(from, to, obstacles, radius) {
  const padding = Math.max(0, radius) + EPSILON;
  return !obstacles.some(obstacle => segmentIntersectsBox(from, to, {
    x: obstacle.x - padding,
    y: obstacle.y - padding,
    w: obstacle.w + padding * 2,
    h: obstacle.h + padding * 2
  }));
}

export function getEnemyWaypoint(from, target, obstacles = [], radius = 0) {
  if (clearSegment(from, target, obstacles, radius)) return target;

  const waypoints = [];
  for (const obstacle of obstacles) {
    const offset = Math.max(0, radius) + EPSILON * 2;
    const left = obstacle.x - offset;
    const right = obstacle.x + obstacle.w + offset;
    const top = obstacle.y - offset;
    const bottom = obstacle.y + obstacle.h + offset;
    waypoints.push(
      { x: left, y: top }, { x: right, y: top },
      { x: right, y: bottom }, { x: left, y: bottom }
    );
  }

  const nodes = [from, target, ...waypoints];
  const distance = Array(nodes.length).fill(Infinity);
  const previous = Array(nodes.length).fill(-1);
  const visited = Array(nodes.length).fill(false);
  distance[0] = 0;

  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited[i] && (current < 0 || distance[i] < distance[current])) current = i;
    }
    if (current < 0 || !Number.isFinite(distance[current])) break;
    if (current === 1) break;
    visited[current] = true;

    for (let next = 0; next < nodes.length; next++) {
      if (visited[next] || current === next || !clearSegment(nodes[current], nodes[next], obstacles, radius)) continue;
      const cost = Math.hypot(nodes[next].x - nodes[current].x, nodes[next].y - nodes[current].y);
      if (distance[current] + cost < distance[next]) {
        distance[next] = distance[current] + cost;
        previous[next] = current;
      }
    }
  }

  if (!Number.isFinite(distance[1])) return target;
  let waypointIndex = 1;
  while (previous[waypointIndex] > 0) waypointIndex = previous[waypointIndex];
  return nodes[waypointIndex];
}

export function getEnemySteering(enemy, target, obstacles = []) {
  const targetChanged = !enemy.navigationTarget ||
    Math.hypot(target.x - enemy.navigationTarget.x, target.y - enemy.navigationTarget.y) > 36;
  const reachedWaypoint = !enemy.navigationWaypoint ||
    Math.hypot(enemy.x - enemy.navigationWaypoint.x, enemy.y - enemy.navigationWaypoint.y) <= Math.max(4, enemy.r * 0.4);

  if (targetChanged || reachedWaypoint) {
    enemy.navigationTarget = { x: target.x, y: target.y };
    enemy.navigationWaypoint = getEnemyWaypoint(enemy, target, obstacles, enemy.r || 13);
  }

  const dx = enemy.navigationWaypoint.x - enemy.x;
  const dy = enemy.navigationWaypoint.y - enemy.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

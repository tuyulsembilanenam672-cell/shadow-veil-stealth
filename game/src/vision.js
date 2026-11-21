// Shadow Veil — line of sight and vision cones.
// A guard sees the player only when the player is inside the cone, close
// enough, and no wall, crate or bush stands on the line between them.
// Cones are drawn by casting rays across the arc and stopping each ray at
// the first solid tile, so cover reads exactly as the guard experiences it.

import { distance, angleDifference } from './config.js';
import { isSolidTile, isBushTile } from './levels.js';

// Is the straight segment from (ax, ay) to (bx, by) free of solid tiles and
// bushes? Sampled every 4 px, which is finer than the smallest gap a player
// can hide behind.
export function hasLineOfSight(level, ax, ay, bx, by) {
  const d = distance(ax, ay, bx, by);
  const steps = Math.max(1, Math.ceil(d / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const c = Math.floor(x / 40);
    const r = Math.floor(y / 40);
    if (isSolidTile(level, c, r) || isBushTile(level, c, r)) return false;
  }
  return true;
}

// Cast one sight ray from (ox, oy) along `angle` until it hits a solid tile
// or bush, or reaches `maxDist`. Returns the ray's end point.
export function castSightRay(level, ox, oy, angle, maxDist) {
  const step = 4;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let dist = 0;
  while (dist < maxDist) {
    dist += step;
    const x = ox + dx * dist;
    const y = oy + dy * dist;
    const c = Math.floor(x / 40);
    const r = Math.floor(y / 40);
    if (isSolidTile(level, c, r) || isBushTile(level, c, r)) {
      return { x: ox + dx * (dist - step), y: oy + dy * (dist - step), dist: dist - step };
    }
  }
  return { x: ox + dx * maxDist, y: oy + dy * maxDist, dist: maxDist };
}

// The polygon of a guard's vision cone, clipped by walls and bushes.
// Returned as points starting at the guard, fanning across the arc.
export function conePolygon(level, guard, range, halfAngle, rays = 26) {
  const points = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i <= rays; i++) {
    const a = guard.facing - halfAngle + (2 * halfAngle * i) / rays;
    points.push(castSightRay(level, guard.x, guard.y, a, range));
  }
  return points;
}

// Is the player inside this guard's cone right now (angle, range and a
// clear line of sight)? Pure geometry — the detection rate is the guard's job.
export function playerInCone(level, guard, px, py, range, halfAngle) {
  const d = distance(guard.x, guard.y, px, py);
  if (d > range) return false;
  const angleTo = Math.atan2(py - guard.y, px - guard.x);
  if (Math.abs(angleDifference(guard.facing, angleTo)) > halfAngle) return false;
  return hasLineOfSight(level, guard.x, guard.y, px, py);
}

// How exposed is the player standing at (px, py)? Returns 'bush', 'shadow'
// or 'lit'. Bushes hide best, shadow helps, open lamplight exposes fully.
export function exposureAt(level, px, py) {
  const c = Math.floor(px / 40);
  const r = Math.floor(py / 40);
  if (isBushTile(level, c, r)) return 'bush';
  if (level.shadow[r] && level.shadow[r][c]) return 'shadow';
  return 'lit';
}

// Clamp a point to the cone's range — used to keep the suspicion math honest
// when the player is far outside the guard's reach.
export function clampToRange(guard, px, py, range) {
  const d = distance(guard.x, guard.y, px, py);
  if (d <= range) return { x: px, y: py, d };
  const t = range / d;
  return {
    x: guard.x + (px - guard.x) * t,
    y: guard.y + (py - guard.y) * t,
    d: range,
  };
}

// Shadow Veil — the player.
// A hooded infiltrator: WASD or arrows to move, hold Shift to sneak, click
// the floor to throw a pebble that draws a guard away. Movement slides along
// walls; sneaking is slower, quieter and harder to spot.

import {
  PLAYER_RADIUS,
  PLAYER_WALK_SPEED,
  PLAYER_SNEAK_SPEED,
  PEBBLE_MAX,
  PEBBLE_RANGE,
  PEBBLE_COOLDOWN,
  distance,
} from './config.js';
import { circleHitsSolid } from './levels.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    facing: -Math.PI / 2,
    sneaking: false,
    moving: false,
    stepTimer: 0,
    stepAlternate: false,
    pebbles: PEBBLE_MAX,
    pebbleCooldown: 0,
  };
}

// Move the player from the held keys. `keys` is a Set of active key names
// (lower-cased, e.g. 'w', 'arrowup', 'shift'). Returns nothing; the player
// object is updated in place and `moving` tells the audio when to step.
export function updatePlayer(level, player, keys, dt) {
  let dx = 0;
  let dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;

  player.sneaking = keys.has('shift');
  player.moving = dx !== 0 || dy !== 0;
  if (!player.moving) return;

  const len = Math.sqrt(dx * dx + dy * dy);
  const speed = player.sneaking ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
  const step = speed * dt;
  const nx = player.x + (dx / len) * step;
  const ny = player.y + (dy / len) * step;

  // Axis-separated movement: slide along a wall instead of stopping dead.
  if (!circleHitsSolid(level, nx, player.y, PLAYER_RADIUS)) player.x = nx;
  if (!circleHitsSolid(level, player.x, ny, PLAYER_RADIUS)) player.y = ny;
  player.facing = Math.atan2(dy, dx);

  // Footstep timing: a step every ~0.34 s walking, ~0.55 s sneaking.
  player.stepTimer -= dt;
  if (player.stepTimer <= 0) {
    player.stepTimer = player.sneaking ? 0.55 : 0.34;
    player.stepAlternate = !player.stepAlternate;
  }
}

// Can the player throw a pebble at (x, y) right now?
export function canThrowPebble(player, x, y) {
  if (player.pebbles <= 0) return false;
  if (player.pebbleCooldown > 0) return false;
  return distance(player.x, player.y, x, y) <= PEBBLE_RANGE;
}

// Throw it: spend the pebble, start the cooldown, and hand back the ping
// point (clamped to the throw range so a far click still lands usefully).
export function throwPebble(player, x, y) {
  const d = distance(player.x, player.y, x, y);
  let px = x;
  let py = y;
  if (d > PEBBLE_RANGE) {
    const t = PEBBLE_RANGE / d;
    px = player.x + (x - player.x) * t;
    py = player.y + (y - player.y) * t;
  }
  player.pebbles -= 1;
  player.pebbleCooldown = PEBBLE_COOLDOWN;
  return { x: px, y: py, born: performance.now() };
}

// Cool the pebble timer down each frame. The HUD reads pebbleCooldown to
// show when the next throw is ready.
export function tickPlayerTimers(player, dt) {
  if (player.pebbleCooldown > 0) {
    player.pebbleCooldown = Math.max(0, player.pebbleCooldown - dt);
  }
}

// Reset the player to a level's start after being caught, keeping the
// pebbles and the artifacts already stolen — a caught thief drops nothing.
export function resetPlayerPosition(player, x, y) {
  player.x = x;
  player.y = y;
  player.facing = -Math.PI / 2;
  player.sneaking = false;
  player.moving = false;
  player.pebbleCooldown = 0;
}

// Is the player standing in a bush (fully hidden) or in shadow (half seen)?
// The renderer darkens the player in a bush so the cover reads on screen.
export function playerCover(level, player) {
  const c = Math.floor(player.x / 40);
  const r = Math.floor(player.y / 40);
  if (level.bush[r] && level.bush[r][c]) return 'bush';
  if (level.shadow[r] && level.shadow[r][c]) return 'shadow';
  return 'lit';
}

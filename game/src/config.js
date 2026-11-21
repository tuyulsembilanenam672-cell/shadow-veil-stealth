// Shadow Veil — tuning constants and palette.
// Every number that shapes how the game feels lives here, so a level or a
// guard never hard-codes a speed, a cone size or a detection rate.

export const TILE = 40;
export const COLS = 24;
export const ROWS = 15;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 600
export const HUD_H = 64;
export const CANVAS_W = VIEW_W;
export const CANVAS_H = VIEW_H + HUD_H;

// Player movement and body.
export const PLAYER_RADIUS = 13;
export const PLAYER_WALK_SPEED = 168;
export const PLAYER_SNEAK_SPEED = 86;
export const PLAYER_SNEAK_KEY = 'Shift';

// Guards: patrol, chase and senses.
export const GUARD_RADIUS = 13;
export const GUARD_PATROL_SPEED = 58;
export const GUARD_CHASE_SPEED = 108;
export const GUARD_SEARCH_SPEED = 78;
export const GUARD_CONE_RANGE = 178;
export const GUARD_CONE_HALF_ANGLE = 0.62; // ~35 degrees each side
export const GUARD_PAUSE_SECONDS = 1.6;
export const GUARD_SCAN_SWEEP = 0.9; // radians the guard sweeps while paused
export const GUARD_CATCH_DISTANCE = 26;
export const GUARD_LOSE_SIGHT_SECONDS = 2.6;
export const GUARD_SEARCH_SECONDS = 2.2;

// Detection: suspicion 0..100. Rates are per second while the player is seen.
export const SUSPICION_MAX = 100;
export const DETECT_RATE_LIT = 72;
export const DETECT_RATE_SHADOW = 26;
export const DETECT_RATE_BUSH = 15;
export const DETECT_SNEAK_FACTOR = 0.5;
export const DETECT_CLOSE_RANGE = 62;
export const DETECT_CLOSE_FACTOR = 1.6;
export const SUSPICION_DECAY = 34;
export const ALERT_DECAY_FLOOR = 42; // an alerted guard calms to this, then decays

// Pebbles: the mouse-thrown distraction.
export const PEBBLE_MAX = 3;
export const PEBBLE_RANGE = 330; // how far the player can throw
export const PEBBLE_HEAR_RANGE = 290; // guards inside this hear the ping
export const PEBBLE_COOLDOWN = 1.0;
export const PEBBLE_INVESTIGATE_SECONDS = 1.6;

// Lives, scoring and timers.
export const LIVES_START = 3;
export const SCORE_ARTIFACT = 500;
export const SCORE_LEVEL_CLEAR = 1000;
export const SCORE_GHOST_BONUS = 800;
export const SCORE_PEBBLE_LEFT = 50;
export const ARTIFACT_PICKUP_RADIUS = 26;
export const EXIT_RADIUS = 26;

// Palette: a night museum — deep blue floor, warm lamps, teal player.
export const PALETTE = {
  floorA: '#20242e',
  floorB: '#1b1f28',
  floorLine: '#262b38',
  wall: '#3a4152',
  wallTop: '#565f75',
  wallEdge: '#14161d',
  crate: '#6b4a2b',
  crateEdge: '#4a3018',
  cratePlank: '#8a6238',
  bush: '#1e4d2e',
  bushLight: '#2f6b41',
  bushDark: '#122e1b',
  shadow: 'rgba(6, 8, 16, 0.55)',
  lampGlow: 'rgba(255, 196, 110, 0.10)',
  exitGlow: '#39e6c3',
  exitDoor: '#0d3f36',
  artifact: '#ffc94d',
  artifactCore: '#fff3c4',
  player: '#37d3b8',
  playerDark: '#1d7a6a',
  guard: '#e8e4d8',
  guardDark: '#8a8578',
  guardUniform: '#3d4a6b',
  conePatrol: 'rgba(255, 214, 90, 0.20)',
  conePatrolEdge: 'rgba(255, 214, 90, 0.45)',
  coneSuspicious: 'rgba(255, 150, 60, 0.30)',
  coneSuspiciousEdge: 'rgba(255, 150, 60, 0.6)',
  coneAlerted: 'rgba(255, 70, 60, 0.34)',
  coneAlertedEdge: 'rgba(255, 70, 60, 0.7)',
  hudBg: '#12141c',
  hudLine: '#2a2f3f',
  text: '#e8e6da',
  textDim: '#9aa0b0',
  textGold: '#ffc94d',
  danger: '#ff5a4e',
  ok: '#39e6c3',
};

// Par times (seconds) used for the time bonus on each level.
export const LEVEL_PARS = [75, 100, 120];

// Small helpers shared by the world, the guards and the renderer.
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleDifference(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function turnTowards(angle, target, maxStep) {
  const d = angleDifference(angle, target);
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}

// Deterministic speckle for a floor tile: the same tile always looks the same,
// so two runs of the game render identical floors.
export function tileSpeckle(col, row, n) {
  let h = (col * 374761393 + row * 668265263) ^ (n * 974634211);
  h = (h ^ (h >> 13)) * 1274126177;
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}

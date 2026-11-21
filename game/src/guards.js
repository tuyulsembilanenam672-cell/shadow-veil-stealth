// Shadow Veil — guard behaviour.
// A guard patrols its waypoints, grows suspicious when something crosses its
// vision cone, chases when it is sure, searches the last place it saw the
// player, and investigates a pebble's ping. The states are small and explicit
// so the cone on screen always matches what the guard is doing.

import {
  GUARD_RADIUS,
  GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED,
  GUARD_SEARCH_SPEED,
  GUARD_PAUSE_SECONDS,
  GUARD_SCAN_SWEEP,
  GUARD_CATCH_DISTANCE,
  GUARD_LOSE_SIGHT_SECONDS,
  GUARD_SEARCH_SECONDS,
  GUARD_CONE_RANGE,
  GUARD_CONE_HALF_ANGLE,
  SUSPICION_MAX,
  SUSPICION_DECAY,
  ALERT_DECAY_FLOOR,
  DETECT_RATE_LIT,
  DETECT_RATE_SHADOW,
  DETECT_RATE_BUSH,
  DETECT_SNEAK_FACTOR,
  DETECT_CLOSE_RANGE,
  DETECT_CLOSE_FACTOR,
  PEBBLE_INVESTIGATE_SECONDS,
  distance,
  turnTowards,
} from './config.js';
import { playerInCone, exposureAt } from './vision.js';
import { circleHitsSolid } from './levels.js';

// Build a guard's runtime state from its level definition and the level's
// difficulty scales (speed and cone range grow on later levels).
export function createGuard(def, index, speedScale, rangeScale) {
  const start = def.waypoints[0];
  return {
    index,
    x: start.x,
    y: start.y,
    facing: Math.PI / 2,
    state: 'patrol', // patrol | suspicious | alerted | search | investigate | return
    suspicion: 0,
    waypointIndex: 1 % def.waypoints.length,
    pauseTimer: 0,
    scanPhase: 0,
    scanBase: Math.PI / 2,
    lastSeen: null,
    loseSightTimer: 0,
    searchTimer: 0,
    investigateTarget: null,
    investigateTimer: 0,
    waypoints: def.waypoints,
    pause: def.pause || GUARD_PAUSE_SECONDS,
    speedScale,
    range: GUARD_CONE_RANGE * rangeScale,
    halfAngle: GUARD_CONE_HALF_ANGLE,
    stuckTimer: 0,
    lastX: start.x,
    lastY: start.y,
    moved: 0,
  };
}

// Move toward (tx, ty) at `speed`, sliding along walls instead of sticking.
// Returns the distance actually travelled this step.
export function moveGuard(level, guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return 0;
  const step = Math.min(speed * dt, d);
  const nx = guard.x + (dx / d) * step;
  const ny = guard.y + (dy / d) * step;
  let moved = 0;
  if (!circleHitsSolid(level, nx, guard.y, GUARD_RADIUS)) {
    moved += Math.abs(nx - guard.x);
    guard.x = nx;
  }
  if (!circleHitsSolid(level, guard.x, ny, GUARD_RADIUS)) {
    moved += Math.abs(ny - guard.y);
    guard.y = ny;
  }
  return moved;
}

// How fast suspicion rises while this guard can see the player: slower in
// shadow, slowest in a bush, halved again while the player sneaks, faster
// when the player is close enough to touch.
export function detectionRate(level, guard, player) {
  const exposure = exposureAt(level, player.x, player.y);
  let rate = exposure === 'bush' ? DETECT_RATE_BUSH
    : exposure === 'shadow' ? DETECT_RATE_SHADOW
    : DETECT_RATE_LIT;
  if (player.sneaking) rate *= DETECT_SNEAK_FACTOR;
  if (distance(guard.x, guard.y, player.x, player.y) < DETECT_CLOSE_RANGE) {
    rate *= DETECT_CLOSE_FACTOR;
  }
  return rate;
}

// One guard, one step. `player` carries x, y and sneaking. Returns an event
// for the game to answer with sound or a state change: 'spotted' when the
// guard goes from calm to a full chase, 'calmed' when a chase gives up and
// the guard walks back to patrol, 'caught' when the guard reaches the player.
export function updateGuard(level, guard, player, dt) {
  const seen = playerInCone(level, guard, player.x, player.y, guard.range, guard.halfAngle);
  let event = null;

  // Suspicion always answers to sight, whatever the guard is doing.
  if (seen) {
    guard.suspicion = Math.min(SUSPICION_MAX, guard.suspicion + detectionRate(level, guard, player) * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.loseSightTimer = 0;
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION_DECAY * dt);
    guard.loseSightTimer += dt;
  }

  // A sure guard gives chase. A chasing guard that cannot find the player
  // searches the last seen spot, then walks back to its patrol.
  if (guard.state !== 'alerted' && guard.suspicion >= SUSPICION_MAX) {
    guard.state = 'alerted';
    guard.loseSightTimer = 0;
    event = 'spotted';
  }

  switch (guard.state) {
    case 'patrol': {
      if (guard.suspicion >= 25) {
        guard.state = 'suspicious';
        break;
      }
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        guard.scanPhase += dt;
        guard.facing = guard.scanBase + Math.sin(guard.scanPhase * 1.4) * GUARD_SCAN_SWEEP;
        if (guard.pauseTimer <= 0) {
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        }
        break;
      }
      const target = guard.waypoints[guard.waypointIndex];
      const moved = moveGuard(level, guard, target.x, target.y, GUARD_PATROL_SPEED * guard.speedScale, dt);
      if (moved > 0.5) {
        guard.facing = turnTowards(guard.facing, Math.atan2(target.y - guard.y, target.x - guard.x), 2.4 * dt);
      }
      if (distance(guard.x, guard.y, target.x, target.y) < 6) {
        guard.pauseTimer = guard.pause;
        guard.scanPhase = 0;
        guard.scanBase = guard.facing;
      }
      break;
    }

    case 'suspicious': {
      // Stop, stare at the player while seen; give up once suspicion fades.
      if (seen) {
        guard.facing = turnTowards(guard.facing, Math.atan2(player.y - guard.y, player.x - guard.x), 5 * dt);
      }
      if (guard.suspicion < 10) guard.state = 'patrol';
      break;
    }

    case 'alerted': {
      const target = seen ? { x: player.x, y: player.y } : guard.lastSeen;
      if (target) {
        const before = distance(guard.x, guard.y, player.x, player.y);
        const moved = moveGuard(level, guard, target.x, target.y, GUARD_CHASE_SPEED * guard.speedScale, dt);
        guard.facing = turnTowards(guard.facing, Math.atan2(target.y - guard.y, target.x - guard.x), 6 * dt);
        if (moved < 2 * dt * 60 && before < guard.range) {
          guard.stuckTimer += dt;
        } else {
          guard.stuckTimer = 0;
        }
        if (distance(guard.x, guard.y, player.x, player.y) < GUARD_CATCH_DISTANCE) {
          event = 'caught';
        }
      }
      if ((!seen && guard.loseSightTimer > GUARD_LOSE_SIGHT_SECONDS) || guard.stuckTimer > 1.4) {
        guard.state = 'search';
        guard.searchTimer = GUARD_SEARCH_SECONDS;
        guard.suspicion = ALERT_DECAY_FLOOR;
        guard.stuckTimer = 0;
        event = event || 'calmed';
      }
      break;
    }

    case 'search': {
      const target = guard.lastSeen || guard.waypoints[guard.waypointIndex];
      moveGuard(level, guard, target.x, target.y, GUARD_SEARCH_SPEED * guard.speedScale, dt);
      guard.facing = turnTowards(guard.facing, Math.atan2(target.y - guard.y, target.x - guard.x), 4 * dt);
      guard.searchTimer -= dt;
      if (guard.searchTimer <= 0) guard.state = 'return';
      break;
    }

    case 'investigate': {
      const target = guard.investigateTarget;
      if (target) {
        moveGuard(level, guard, target.x, target.y, GUARD_SEARCH_SPEED * guard.speedScale, dt);
        guard.facing = turnTowards(guard.facing, Math.atan2(target.y - guard.y, target.x - guard.x), 4 * dt);
        if (distance(guard.x, guard.y, target.x, target.y) < 10) {
          guard.investigateTimer -= dt;
          guard.facing += Math.sin(guard.investigateTimer * 3) * 0.02;
          if (guard.investigateTimer <= 0) guard.state = 'return';
        }
      } else {
        guard.state = 'return';
      }
      break;
    }

    case 'return': {
      // Walk back to the nearest waypoint, then resume the patrol from there.
      let nearest = 0;
      let nearestD = Infinity;
      guard.waypoints.forEach((w, i) => {
        const d = distance(guard.x, guard.y, w.x, w.y);
        if (d < nearestD) { nearestD = d; nearest = i; }
      });
      const target = guard.waypoints[nearest];
      moveGuard(level, guard, target.x, target.y, GUARD_PATROL_SPEED * guard.speedScale, dt);
      guard.facing = turnTowards(guard.facing, Math.atan2(target.y - guard.y, target.x - guard.x), 3 * dt);
      if (nearestD < 8) {
        guard.waypointIndex = (nearest + 1) % guard.waypoints.length;
        guard.state = 'patrol';
        guard.pauseTimer = 0;
      }
      break;
    }
  }

  return event;
}

// Send a guard to look at a pebble's ping. A patrolling or suspicious guard
// walks over; a chasing guard ignores it — it already has a target.
export function sendGuardToNoise(guard, x, y) {
  if (guard.state === 'alerted') return;
  guard.state = 'investigate';
  guard.investigateTarget = { x, y };
  guard.investigateTimer = PEBBLE_INVESTIGATE_SECONDS;
}

// The guard's current alert colour for its cone and its marker.
export function guardAlertLevel(guard) {
  if (guard.state === 'alerted') return 'alerted';
  if (guard.state === 'suspicious' || guard.suspicion >= 25) return 'suspicious';
  return 'patrol';
}

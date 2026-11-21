// Shadow Veil — canvas rendering.
// Everything on screen is drawn procedurally: the museum floor, the walls,
// the crates and bushes you hide behind, the guards and their vision cones,
// the player, the HUD and every screen. No images, no fonts from the network.

import {
  TILE,
  VIEW_W,
  VIEW_H,
  HUD_H,
  PALETTE,
  tileSpeckle,
} from './config.js';
import { conePolygon } from './vision.js';
import { guardAlertLevel } from './guards.js';

// The world is drawn below the HUD bar.
export const WORLD_Y = HUD_H;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawFloor(ctx, level) {
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const x = c * TILE;
      const y = WORLD_Y + r * TILE;
      ctx.fillStyle = (c + r) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(x, y, TILE, TILE);
      // A deterministic speckle so the floor has texture but never changes.
      const s = tileSpeckle(c, r, 1);
      if (s > 0.72) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(x + 6 + s * 20, y + 8 + tileSpeckle(c, r, 2) * 20, 3, 3);
      }
      ctx.strokeStyle = PALETTE.floorLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      if (level.shadow[r][c]) {
        ctx.fillStyle = PALETTE.shadow;
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
}

function drawWall(ctx, level) {
  // Walls: raised slate blocks with a lit top edge, so cover reads at a glance.
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const ch = level.raw[r][c];
      if (ch !== '#') continue;
      const x = c * TILE;
      const y = WORLD_Y + r * TILE;
      ctx.fillStyle = PALETTE.wallEdge;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(x + 2, y + 2, TILE - 4, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x + 5, y + 12, TILE - 10, 2);
    }
  }
}

function drawCrates(ctx, level) {
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (level.raw[r][c] !== 'C') continue;
      const x = c * TILE;
      const y = WORLD_Y + r * TILE;
      ctx.fillStyle = PALETTE.crateEdge;
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = PALETTE.crate;
      ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
      ctx.strokeStyle = PALETTE.cratePlank;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 5);
      ctx.lineTo(x + TILE - 5, y + TILE - 5);
      ctx.moveTo(x + TILE - 5, y + 5);
      ctx.lineTo(x + 5, y + TILE - 5);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.crateEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 5.5, y + 5.5, TILE - 11, TILE - 11);
    }
  }
}

function drawBushes(ctx, level, time) {
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (level.raw[r][c] !== 'B') continue;
      const x = c * TILE + TILE / 2;
      const y = WORLD_Y + r * TILE + TILE / 2;
      const sway = Math.sin(time * 1.1 + c * 1.7 + r * 2.3) * 1.5;
      ctx.fillStyle = PALETTE.bushDark;
      ctx.beginPath();
      ctx.arc(x - 9 + sway, y + 6, 12, 0, Math.PI * 2);
      ctx.arc(x + 10 + sway, y + 7, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bush;
      ctx.beginPath();
      ctx.arc(x - 8 + sway, y - 2, 13, 0, Math.PI * 2);
      ctx.arc(x + 9 + sway, y - 1, 12, 0, Math.PI * 2);
      ctx.arc(x + sway, y - 9, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.bushLight;
      ctx.beginPath();
      ctx.arc(x - 6 + sway, y - 6, 5, 0, Math.PI * 2);
      ctx.arc(x + 7 + sway, y - 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawExit(ctx, level, allCollected, time) {
  const e = level.exit;
  const pulse = 0.65 + Math.sin(time * 3) * 0.25;
  const x = e.x;
  const y = WORLD_Y + e.y;
  ctx.save();
  ctx.globalAlpha = allCollected ? pulse : 0.35;
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 46);
  glow.addColorStop(0, 'rgba(57,230,195,0.55)');
  glow.addColorStop(1, 'rgba(57,230,195,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // The door itself: a teal frame with a lit passage and an arrow.
  ctx.fillStyle = PALETTE.exitDoor;
  roundRect(ctx, x - 17, y - 19, 34, 38, 4);
  ctx.fill();
  ctx.strokeStyle = PALETTE.exitGlow;
  ctx.lineWidth = 2;
  roundRect(ctx, x - 17, y - 19, 34, 38, 4);
  ctx.stroke();
  ctx.fillStyle = allCollected ? PALETTE.exitGlow : '#1d5a4e';
  ctx.font = 'bold 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(allCollected ? '➤' : '✦', x, y + 1);

  ctx.font = 'bold 11px Trebuchet MS, sans-serif';
  ctx.fillStyle = allCollected ? PALETTE.exitGlow : PALETTE.textDim;
  ctx.fillText('EXIT', x, y - 28);
}

function drawArtifacts(ctx, level, time) {
  for (const a of level.artifacts) {
    if (a.taken) continue;
    const x = a.x;
    const y = WORLD_Y + a.y;
    const bob = Math.sin(time * 2.4 + a.x) * 2;
    const glow = ctx.createRadialGradient(x, y + bob, 2, x, y + bob, 26);
    glow.addColorStop(0, 'rgba(255,201,77,0.5)');
    glow.addColorStop(1, 'rgba(255,201,77,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y + bob, 26, 0, Math.PI * 2);
    ctx.fill();
    // A rotating diamond relic.
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(Math.PI / 4 + Math.sin(time * 1.2 + a.y) * 0.15);
    ctx.fillStyle = PALETTE.artifact;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = PALETTE.artifactCore;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
}

function drawGuard(ctx, level, guard, time) {
  const level_alert = guardAlertLevel(guard);
  const range = guard.range;
  const half = guard.halfAngle;

  // The vision cone, clipped by walls and bushes, coloured by alert state.
  const poly = conePolygon(level, { x: guard.x, y: guard.y, facing: guard.facing }, range, half);
  const fill = level_alert === 'alerted' ? PALETTE.coneAlerted
    : level_alert === 'suspicious' ? PALETTE.coneSuspicious
    : PALETTE.conePatrol;
  const edge = level_alert === 'alerted' ? PALETTE.coneAlertedEdge
    : level_alert === 'suspicious' ? PALETTE.coneSuspiciousEdge
    : PALETTE.conePatrolEdge;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(guard.x, WORLD_Y + guard.y);
  for (const p of poly) ctx.lineTo(p.x, WORLD_Y + p.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.stroke();

  const gx = guard.x;
  const gy = WORLD_Y + guard.y;

  // Suspicion arc above the guard's head.
  if (guard.suspicion > 2) {
    ctx.strokeStyle = level_alert === 'alerted' ? PALETTE.danger : PALETTE.textGold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gx, gy - 20, 9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * guard.suspicion) / 100);
    ctx.stroke();
  }

  // Body: a uniformed guard, visor facing where he looks.
  ctx.fillStyle = PALETTE.guardDark;
  ctx.beginPath();
  ctx.arc(gx, gy, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.guardUniform;
  ctx.beginPath();
  ctx.arc(gx, gy, 12, 0, Math.PI * 2);
  ctx.fill();
  const fx = Math.cos(guard.facing);
  const fy = Math.sin(guard.facing);
  ctx.fillStyle = PALETTE.guard;
  ctx.beginPath();
  ctx.arc(gx + fx * 5, gy + fy * 5, 7, 0, Math.PI * 2);
  ctx.fill();
  // Visor slit.
  ctx.strokeStyle = '#20242e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gx + fx * 8 - fy * 4, gy + fy * 8 + fx * 4);
  ctx.lineTo(gx + fx * 8 + fy * 4, gy + fy * 8 - fx * 4);
  ctx.stroke();

  // "?" while suspicious, "!" while chasing.
  if (level_alert !== 'patrol') {
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = level_alert === 'alerted' ? PALETTE.danger : PALETTE.textGold;
    ctx.fillText(level_alert === 'alerted' ? '!' : '?', gx, gy - 34);
  }
}

function drawPlayer(ctx, game, time) {
  const p = game.player;
  const x = p.x;
  const y = WORLD_Y + p.y;
  const cover = game.cover || 'lit';

  // A soft light pool around the player: the lit floor is safe to read.
  const light = ctx.createRadialGradient(x, y, 8, x, y, 90);
  light.addColorStop(0, 'rgba(255,220,150,0.10)');
  light.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(x, y, 90, 0, Math.PI * 2);
  ctx.fill();

  // Shadow under the body, smaller while sneaking (crouched).
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(x, y + 11, p.sneaking ? 9 : 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyR = p.sneaking ? 10 : 13;
  ctx.globalAlpha = cover === 'bush' ? 0.55 : 1;
  ctx.fillStyle = PALETTE.playerDark;
  ctx.beginPath();
  ctx.arc(x, y, bodyR + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.arc(x, y, bodyR, 0, Math.PI * 2);
  ctx.fill();
  // The hood: a triangle pointing where the player faces.
  const fx = Math.cos(p.facing);
  const fy = Math.sin(p.facing);
  ctx.fillStyle = PALETTE.playerDark;
  ctx.beginPath();
  ctx.moveTo(x + fx * (bodyR + 6), y + fy * (bodyR + 6));
  ctx.lineTo(x - fy * 7, y + fx * 7);
  ctx.lineTo(x + fy * 7, y - fx * 7);
  ctx.closePath();
  ctx.fill();
  // Eyes.
  ctx.fillStyle = '#0b0e14';
  ctx.beginPath();
  ctx.arc(x + fx * 4 - fy * 3.5, y + fy * 4 + fx * 3.5, 1.8, 0, Math.PI * 2);
  ctx.arc(x + fx * 4 + fy * 3.5, y + fy * 4 - fx * 3.5, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Sneak ring: a dotted circle while sneaking, so the state is visible.
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(55,211,184,0.7)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawPings(ctx, game, now) {
  for (const ping of game.pings) {
    const age = (now - ping.born) / 1000;
    if (age > 1.2) continue;
    const r = 8 + age * 46;
    ctx.strokeStyle = `rgba(255,214,90,${Math.max(0, 0.85 - age * 0.7)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ping.x, WORLD_Y + ping.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHud(ctx, game) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = PALETTE.hudLine;
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 19px Georgia, serif';
  ctx.fillText('SHADOW VEIL', 14, 22);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '13px Trebuchet MS, sans-serif';
  ctx.fillText(game.levelDef.name + '  ·  Level ' + (game.levelIndex + 1) + ' of 3', 14, 46);

  // Artifacts: filled gems for stolen, dim for remaining.
  const total = game.level.artifacts.length;
  const got = game.level.artifacts.filter((a) => a.taken).length;
  for (let i = 0; i < total; i++) {
    const x = 330 + i * 26;
    ctx.save();
    ctx.translate(x, 32);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = i < got ? PALETTE.artifact : '#3a3f4d';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 15px Trebuchet MS, sans-serif';
  ctx.fillText(got + '/' + total + ' relics', 330 + total * 26 + 6, 32);

  // Timer.
  const t = Math.max(0, game.timeLeft);
  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60);
  ctx.fillStyle = t < 15 ? PALETTE.danger : PALETTE.text;
  ctx.font = 'bold 20px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mm + ':' + String(ss).padStart(2, '0'), 620, 32);

  // Score and lives.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.textGold;
  ctx.font = 'bold 18px Trebuchet MS, sans-serif';
  ctx.fillText('★ ' + game.score, 800, 24);
  ctx.fillStyle = PALETTE.danger;
  ctx.font = '16px Trebuchet MS, sans-serif';
  ctx.fillText('♥'.repeat(game.lives) + '♡'.repeat(Math.max(0, 3 - game.lives)), 800, 48);

  // Pebbles left and mute state.
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '13px Trebuchet MS, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('●'.repeat(game.player.pebbles) + '○'.repeat(Math.max(0, 3 - game.player.pebbles)) + ' pebbles', 940, 24);
  ctx.fillText(game.muted ? 'M: sound off' : 'M: sound on', 940, 46);

  // Alert banner: the single most important thing on screen.
  const worst = game.guards.reduce((w, g) => {
    const a = guardAlertLevel(g);
    if (a === 'alerted') return 'alerted';
    if (a === 'suspicious' && w !== 'alerted') return 'suspicious';
    return w;
  }, 'patrol');
  if (worst !== 'patrol') {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Trebuchet MS, sans-serif';
    ctx.fillStyle = worst === 'alerted' ? PALETTE.danger : PALETTE.textGold;
    ctx.fillText(worst === 'alerted' ? 'SPOTTED — BREAK LINE OF SIGHT!' : 'SUSPICIOUS — STAY OUT OF THE CONES', 480, 52);
  }
}

// A dim overlay panel with centred text lines, used by every screen.
function panel(ctx, lines, title) {
  ctx.fillStyle = 'rgba(8,10,16,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H + HUD_H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.textGold;
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText(title, VIEW_W / 2, 150);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '17px Trebuchet MS, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, 215 + i * 28);
  });
}

function button(ctx, label, y, hover) {
  const w = 260;
  const x = VIEW_W / 2 - w / 2;
  ctx.fillStyle = hover ? '#2a6f62' : '#1d4a41';
  roundRect(ctx, x, y, w, 46, 8);
  ctx.fill();
  ctx.strokeStyle = PALETTE.exitGlow;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, 46, 8);
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 18px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, VIEW_W / 2, y + 24);
  return { x, y, w, h: 46 };
}

export function drawTitle(ctx, game) {
  panel(ctx, [
    'A top-down stealth game. Steal every relic, reach the exit unseen.',
    '',
    'Move: WASD or arrow keys      Sneak: hold Shift (slower, harder to spot)',
    'Distract: click the floor to throw a pebble (guards come to look)',
    'Hide in bushes and shadow — a guard only sees what its cone touches.',
    'Collect every relic to open the exit. Three lives. Three levels.',
    '',
    'Click START or press Enter.',
  ], 'SHADOW VEIL');
  game.buttons = { start: button(ctx, 'START THE JOB', 480, game.hoverButton === 'start') };
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = '13px Trebuchet MS, sans-serif';
  ctx.fillText('An original game — all art drawn in code, all sound synthesized.', VIEW_W / 2, 560);
}

export function drawLevelIntro(ctx, game) {
  const def = game.levelDef;
  panel(ctx, [
    def.sub,
    '',
    game.level.artifacts.length + ' relics to steal  ·  ' + game.guards.length + ' guards on patrol',
    'Par time ' + def.par + 's — beat it for a time bonus. Ghost bonus if no guard ever spots you.',
    '',
    'Press Enter or click to begin.',
  ], def.name.toUpperCase());
  game.buttons = { start: button(ctx, 'BEGIN LEVEL ' + (game.levelIndex + 1), 480, game.hoverButton === 'start') };
}

export function drawPaused(ctx, game) {
  panel(ctx, [
    'Paused. The guards wait for no one — except right now.',
    '',
    'Enter / P: resume      R: restart level      M: mute      Esc: title screen',
  ], 'PAUSED');
  game.buttons = { start: button(ctx, 'RESUME', 480, game.hoverButton === 'start') };
}

export function drawLevelComplete(ctx, game) {
  const s = game.levelStats;
  panel(ctx, [
    'All relics stolen. You slipped out like smoke.',
    '',
    'Time: ' + s.timeUsed.toFixed(1) + 's  (par ' + game.levelDef.par + 's)',
    'Time bonus: +' + s.timeBonus + '      Ghost bonus: ' + (s.ghost ? '+800 — never spotted!' : '— spotted once'),
    'Pebbles left: ' + s.pebblesLeft + '  (+' + s.pebblesLeft * 50 + ')',
    'Level score: ' + s.levelScore + '      Total: ' + game.score,
    '',
    'Press Enter or click for the next level.',
  ], 'CLEAN GETAWAY');
  game.buttons = { start: button(ctx, 'NEXT LEVEL', 500, game.hoverButton === 'start') };
}

export function drawGameOver(ctx, game) {
  panel(ctx, [
    'The guards caught you three times. The museum keeps its relics.',
    '',
    'Score: ' + game.score + '      Level reached: ' + (game.levelIndex + 1),
    '',
    'Press Enter or click to try again from the start.',
  ], 'CAUGHT');
  game.buttons = { start: button(ctx, 'TRY AGAIN', 480, game.hoverButton === 'start') };
}

export function drawVictory(ctx, game) {
  const stars = game.totalStars;
  panel(ctx, [
    'Every relic stolen. Every exit reached. Nobody saw a thing.',
    '',
    'Final score: ' + game.score,
    'Stars: ' + '★'.repeat(stars) + '☆'.repeat(Math.max(0, 9 - stars)) + '  (' + stars + ' of 9)',
    'Ghost levels: ' + game.ghostLevels + ' of 3',
    '',
    'Press Enter or click to play again.',
  ], 'GHOST OF THE GALLERY');
  game.buttons = { start: button(ctx, 'PLAY AGAIN', 500, game.hoverButton === 'start') };
}

// Draw the whole frame for the game's current state.
export function renderGame(ctx, game, time) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H + HUD_H);
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H + HUD_H);

  const state = game.state;
  if (state === 'title') {
    drawTitle(ctx, game);
    return;
  }

  // The world is always drawn under the play states and the overlays.
  drawFloor(ctx, game.level);
  drawExit(ctx, game.level, game.allCollected, time);
  drawArtifacts(ctx, game.level, time);
  drawCrates(ctx, game.level);
  drawBushes(ctx, game.level, time);
  drawWall(ctx, game.level);
  for (const guard of game.guards) drawGuard(ctx, game.level, guard, time);
  drawPings(ctx, game, performance.now());
  drawPlayer(ctx, game, time);

  // Night vignette: the edges of the museum are darker than the lamplight.
  const vig = ctx.createRadialGradient(
    VIEW_W / 2, WORLD_Y + VIEW_H / 2, VIEW_H * 0.45,
    VIEW_W / 2, WORLD_Y + VIEW_H / 2, VIEW_H * 0.95,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, WORLD_Y, VIEW_W, VIEW_H);

  drawHud(ctx, game);

  if (state === 'intro') drawLevelIntro(ctx, game);
  else if (state === 'paused') drawPaused(ctx, game);
  else if (state === 'levelcomplete') drawLevelComplete(ctx, game);
  else if (state === 'gameover') drawGameOver(ctx, game);
  else if (state === 'victory') drawVictory(ctx, game);
}

// Which of the current screen's buttons, if any, holds the mouse?
export function buttonAt(game, x, y) {
  if (!game.buttons) return null;
  for (const [name, b] of Object.entries(game.buttons)) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return name;
  }
  return null;
}

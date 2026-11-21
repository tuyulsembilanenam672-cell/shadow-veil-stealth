// Shadow Veil — the game itself.
// Wires the levels, guards, player, input, audio and renderer into one
// state machine: title, level intro, playing, paused, level complete,
// game over, victory. Scoring rewards clean, fast, unseen play.

import {
  CANVAS_W,
  CANVAS_H,
  SCORE_ARTIFACT,
  SCORE_LEVEL_CLEAR,
  SCORE_GHOST_BONUS,
  SCORE_PEBBLE_LEFT,
  ARTIFACT_PICKUP_RADIUS,
  EXIT_RADIUS,
  LIVES_START,
  PEBBLE_HEAR_RANGE,
  distance,
} from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import {
  createGuard,
  updateGuard,
  sendGuardToNoise,
} from './guards.js';
import {
  createPlayer,
  updatePlayer,
  canThrowPebble,
  throwPebble,
  tickPlayerTimers,
  resetPlayerPosition,
  playerCover,
} from './player.js';
import { renderGame, buttonAt, WORLD_Y } from './render.js';
import {
  createInput,
  attachInput,
  wasPressed,
  endFrameInput,
} from './input.js';
import {
  unlockAudio,
  toggleMute,
  playStep,
  playSuspicionBlip,
  playAlert,
  playPebble,
  playPickup,
  playCaught,
  playLevelClear,
  playVictory,
  playGameOver,
  playClick,
} from './audio.js';
import { applyShotScene, shotFromUrl, SHOT_NAMES } from './shots.js';

// Time allowed per level: the par time plus a minute of grace.
function levelTimeLimit(def) {
  return def.par + 60;
}

export function createGame(canvas) {
  const game = {
    canvas,
    ctx: canvas.getContext('2d'),
    input: createInput(),
    state: 'title',
    levelIndex: 0,
    levelDef: LEVELS[0],
    level: null,
    guards: [],
    player: null,
    score: 0,
    lives: LIVES_START,
    timeLeft: 0,
    timeUsed: 0,
    pings: [],
    frozen: false,
    frozenTime: 2.5,
    muted: false,
    cover: 'lit',
    allCollected: false,
    levelGhost: true,
    levelStats: null,
    totalStars: 0,
    ghostLevels: 0,
    hoverButton: null,
    buttons: null,
    blipTimer: 0,
    lastTime: 0,
  };

  game.loadLevel = function loadLevel(index) {
    game.levelIndex = index;
    game.levelDef = LEVELS[index];
    game.level = parseLevel(game.levelDef);
    game.guards = game.level.guards.map(
      (g, i) => createGuard(g, i, game.levelDef.guardSpeed, game.levelDef.coneRange),
    );
    game.player = createPlayer(game.level.playerStart.x, game.level.playerStart.y);
    game.player.pebbles = game.levelDef.pebbles;
    game.pings = [];
    game.timeLeft = levelTimeLimit(game.levelDef);
    game.timeUsed = 0;
    game.allCollected = false;
    game.levelGhost = true;
    game.levelStats = null;
    game.frozen = false;
  };

  game.resetRun = function resetRun() {
    game.score = 0;
    game.lives = LIVES_START;
    game.totalStars = 0;
    game.ghostLevels = 0;
    game.loadLevel(0);
  };

  return game;
}

// Stars for a finished level: 3 for a ghost run under par, 2 under par + 30s,
// otherwise 1. A ghost run is one where no guard ever reached full alert.
function starsForLevel(game, timeUsed) {
  if (game.levelGhost && timeUsed <= game.levelDef.par) return 3;
  if (timeUsed <= game.levelDef.par + 30) return 2;
  return 1;
}

function loseLife(game, reason) {
  game.lives -= 1;
  playCaught();
  if (game.lives <= 0) {
    game.state = 'gameover';
    playGameOver();
    return;
  }
  // Caught: back to the start of the level, guards reset, relics kept.
  const taken = game.level.artifacts.map((a) => a.taken);
  game.loadLevel(game.levelIndex);
  game.level.artifacts.forEach((a, i) => { a.taken = taken[i]; });
  game.allCollected = game.level.artifacts.every((a) => a.taken);
  game.score = Math.max(0, game.score);
}

function completeLevel(game) {
  const timeUsed = game.timeUsed;
  const timeBonus = Math.max(0, Math.round((game.levelDef.par - timeUsed) * 10));
  const ghostBonus = game.levelGhost ? SCORE_GHOST_BONUS : 0;
  const pebbleBonus = game.player.pebbles * SCORE_PEBBLE_LEFT;
  const levelScore = SCORE_LEVEL_CLEAR + timeBonus + ghostBonus + pebbleBonus;
  const stars = starsForLevel(game, timeUsed);
  game.totalStars += stars;
  if (game.levelGhost) game.ghostLevels += 1;
  game.score += levelScore;
  game.levelStats = {
    timeUsed,
    timeBonus,
    ghost: game.levelGhost,
    pebblesLeft: game.player.pebbles,
    levelScore,
    stars,
  };
  if (game.levelIndex >= LEVELS.length - 1) {
    game.state = 'victory';
    playVictory();
  } else {
    game.state = 'levelcomplete';
    playLevelClear();
  }
}

// One frame of play: move the player, run the guards, pick up relics,
// watch the exit and the clock. Returns nothing; events play their sounds.
function updatePlaying(game, dt) {
  const input = game.input;
  const player = game.player;

  tickPlayerTimers(player, dt);
  const stepBefore = player.stepTimer;
  updatePlayer(game.level, player, input.keys, dt);
  if (player.moving && player.stepTimer > stepBefore) {
    playStep(player.stepAlternate, player.sneaking);
  }
  game.cover = playerCover(game.level, player);

  // A click on the floor throws a pebble; the nearest guard comes to look.
  if (input.click) {
    const wx = input.click.x;
    const wy = input.click.y - WORLD_Y;
    if (wy >= 0 && wy < 600) {
      if (canThrowPebble(player, wx, wy)) {
        const ping = throwPebble(player, wx, wy);
        game.pings.push(ping);
        playPebble();
        let nearest = null;
        let nearestD = Infinity;
        for (const g of game.guards) {
          const d = distance(g.x, g.y, ping.x, ping.y);
          if (d < PEBBLE_HEAR_RANGE && d < nearestD) { nearest = g; nearestD = d; }
        }
        if (nearest) sendGuardToNoise(nearest, ping.x, ping.y);
      }
    }
  }

  // Guards: run their state machines and answer their events.
  for (const guard of game.guards) {
    const event = updateGuard(game.level, guard, player, dt);
    if (event === 'spotted') {
      game.levelGhost = false;
      playAlert();
    } else if (event === 'caught') {
      loseLife(game, 'caught');
      return;
    }
  }

  // A rising suspicion deserves a blip so the player hears the danger.
  game.blipTimer -= dt;
  if (game.blipTimer <= 0) {
    const worst = game.guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
    if (worst >= 25 && worst < 100) {
      playSuspicionBlip(worst);
      game.blipTimer = 0.5;
    } else {
      game.blipTimer = 0.2;
    }
  }

  // Relics: walk over one to steal it.
  for (const a of game.level.artifacts) {
    if (!a.taken && distance(player.x, player.y, a.x, a.y) < ARTIFACT_PICKUP_RADIUS) {
      a.taken = true;
      game.score += SCORE_ARTIFACT;
      playPickup();
    }
  }
  game.allCollected = game.level.artifacts.every((a) => a.taken);

  // The exit opens once every relic is stolen.
  if (game.allCollected
    && distance(player.x, player.y, game.level.exit.x, game.level.exit.y) < EXIT_RADIUS) {
    completeLevel(game);
    return;
  }

  // The clock: run out of time and the alarm trips — a life is lost.
  game.timeLeft -= dt;
  game.timeUsed += dt;
  if (game.timeLeft <= 0) {
    loseLife(game, 'time');
  }
}

// Advance from a screen: what Enter, Space or a button click does.
function advanceScreen(game) {
  playClick();
  switch (game.state) {
    case 'title':
      game.resetRun();
      game.state = 'intro';
      break;
    case 'intro':
      game.state = 'playing';
      break;
    case 'paused':
      game.state = 'playing';
      break;
    case 'levelcomplete':
      game.loadLevel(game.levelIndex + 1);
      game.state = 'intro';
      break;
    case 'gameover':
      game.resetRun();
      game.state = 'intro';
      break;
    case 'victory':
      game.resetRun();
      game.state = 'title';
      break;
    default:
      break;
  }
}

// One frame: read the edges, run the state machine, draw, clear the edges.
function frame(game, now) {
  const dt = Math.min(0.05, Math.max(0, (now - game.lastTime) / 1000 || 0.016));
  game.lastTime = now;
  const input = game.input;

  // Any key or click wakes the audio on first use.
  if (input.pressed.size > 0 || input.click) unlockAudio();

  if (!game.frozen) {
    if (wasPressed(input, 'm')) {
      game.muted = toggleMute();
    }

    if (game.state === 'playing') {
      if (wasPressed(input, 'p') || wasPressed(input, 'escape')) {
        game.state = 'paused';
        playClick();
      } else if (wasPressed(input, 'r')) {
        const taken = game.level.artifacts.map((a) => a.taken);
        game.loadLevel(game.levelIndex);
        game.level.artifacts.forEach((a, i) => { a.taken = taken[i]; });
        game.allCollected = game.level.artifacts.every((a) => a.taken);
        playClick();
      } else {
        updatePlaying(game, dt);
      }
    } else if (wasPressed(input, 'enter') || wasPressed(input, ' ')) {
      advanceScreen(game);
    } else if (game.state === 'paused' && (wasPressed(input, 'escape') || wasPressed(input, 'p'))) {
      game.state = 'playing';
      playClick();
    }

    if (input.click) {
      const hit = buttonAt(game, input.click.x, input.click.y);
      if (hit === 'start') advanceScreen(game);
    }
  }

  // Hover state for the buttons on the screens.
  game.hoverButton = input.mouse.inside
    ? buttonAt(game, input.mouse.x, input.mouse.y)
    : null;

  const time = game.frozen ? game.frozenTime : now / 1000;
  renderGame(game.ctx, game, time);
  endFrameInput(input);
}

// Boot the game on the page's canvas and start the loop.
export function bootGame(canvas) {
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const game = createGame(canvas);
  game.loadLevel(0);
  game.state = 'title';
  attachInput(game.input, canvas);

  const shot = shotFromUrl();
  if (shot) applyShotScene(game, shot);

  // A handle for play-testing and screenshots: the driver can stage any
  // scene and read the live state back.
  window.__shadowVeil = {
    game,
    applyShotScene: (name) => applyShotScene(game, name),
    shots: SHOT_NAMES,
    state: () => ({
      state: game.state,
      level: game.levelIndex + 1,
      score: game.score,
      lives: game.lives,
      timeLeft: Math.round(game.timeLeft),
      artifacts: game.level.artifacts.filter((a) => a.taken).length
        + '/' + game.level.artifacts.length,
      player: { x: Math.round(game.player.x), y: Math.round(game.player.y) },
      guards: game.guards.map((g) => ({
        state: g.state,
        suspicion: Math.round(g.suspicion),
        x: Math.round(g.x),
        y: Math.round(g.y),
      })),
    }),
  };

  game.lastTime = performance.now();
  const loop = (now) => {
    frame(game, now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return game;
}

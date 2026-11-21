// Shadow Veil — staged screenshot scenes.
// These presets put the game into a chosen moment (a guard's cone sweeping
// past a crate, a player hidden in a bush, the run for the exit, the win
// screen) so screenshots are real renders of the game's own code, frozen in
// a readable frame. Nothing here draws anything itself: it only moves the
// pieces the game already renders. The game runs identically without it.

function tileCenter(col, row) {
  return { x: (col + 0.5) * 40, y: (row + 0.5) * 40 };
}

function placeGuard(game, index, col, row, facing, suspicion, state) {
  const g = game.guards[index];
  if (!g) return;
  const p = tileCenter(col, row);
  g.x = p.x;
  g.y = p.y;
  g.facing = facing;
  g.suspicion = suspicion;
  g.state = state || 'patrol';
  g.pauseTimer = 0;
}

function placePlayer(game, col, row, sneaking) {
  const p = tileCenter(col, row);
  game.player.x = p.x;
  game.player.y = p.y;
  game.player.sneaking = !!sneaking;
  game.player.moving = false;
}

function takeArtifacts(game, count) {
  game.level.artifacts.forEach((a, i) => {
    a.taken = i < count;
  });
}

// Freeze the game in a staged moment: updates stop, rendering continues,
// so a screenshot catches exactly this frame.
function freeze(game, score, timeLeft) {
  game.score = score;
  game.timeLeft = timeLeft;
  game.state = 'playing';
  game.frozen = true;
  game.cover = 'lit';
}

export const SHOT_NAMES = ['cover', 'hide', 'exit', 'win'];

export function applyShotScene(game, name) {
  if (name === 'cover') {
    // Level 1: crouched behind a crate while a guard's cone sweeps past.
    game.loadLevel(0);
    takeArtifacts(game, 1);
    placePlayer(game, 6, 2, true);
    placeGuard(game, 0, 11, 4, Math.PI, 0, 'patrol');
    placeGuard(game, 1, 19, 9, -Math.PI / 2, 0, 'patrol');
    freeze(game, 500, 68);
    return 'cover: level 1, behind a crate, guard cone sweeping past';
  }

  if (name === 'hide') {
    // Level 2: hidden in a bush while a guard grows suspicious nearby.
    game.loadLevel(1);
    takeArtifacts(game, 2);
    placePlayer(game, 2, 3, true);
    placeGuard(game, 0, 11, 3, Math.PI, 45, 'suspicious');
    placeGuard(game, 2, 4, 10, 0, 0, 'patrol');
    freeze(game, 1200, 71);
    return 'hide: level 2, in a bush, guard suspicious with a ? overhead';
  }

  if (name === 'exit') {
    // Level 3: every relic stolen, the exit glowing, a guard giving chase.
    game.loadLevel(2);
    takeArtifacts(game, 3);
    placePlayer(game, 20, 13, false);
    placeGuard(game, 1, 19, 11, Math.PI / 3, 100, 'alerted');
    placeGuard(game, 3, 20, 4, Math.PI, 0, 'patrol');
    freeze(game, 3100, 44);
    return 'exit: level 3, all relics stolen, exit open, guard in pursuit';
  }

  if (name === 'win') {
    // The victory screen after a clean run through all three levels.
    game.loadLevel(2);
    takeArtifacts(game, 3);
    game.score = 7420;
    game.totalStars = 8;
    game.ghostLevels = 2;
    game.state = 'victory';
    game.frozen = true;
    return 'win: victory screen, 7420 points, 8 of 9 stars';
  }

  return null;
}

// Read a ?shot=name query from the page URL, if the maker opened one.
export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const name = q.get('shot');
    return SHOT_NAMES.includes(name) ? name : null;
  } catch (e) {
    return null;
  }
}

// Shadow Veil — level definitions.
// Maps are 24 x 15 grids of one character per tile:
//   # wall (blocks sight and movement)   C crate (cover, blocks sight)
//   B bush (hides the player, blocks sight)   S shadow floor (dark, slow detection)
//   . open floor   P player start   E exit   A artifact to steal
// Guards patrol between waypoints given in tile coordinates (tile centres).

export const LEVELS = [
  {
    name: 'The Gallery',
    sub: 'Two guards. Learn the patrols, take both relics, slip out.',
    par: 75,
    pebbles: 3,
    guardSpeed: 1.0,
    coneRange: 1.0,
    map: [
      '########################',
      '#P....C......B.........#',
      '#.....#......#....A....#',
      '#..B..#..C...#.........#',
      '#.....#......#....#....#',
      '#..C.....B........#....#',
      '#.....#......#....#....#',
      '####..#..C...#....#....#',
      '#.....#......#....#....#',
      '#..B..#..C...#.........#',
      '#.....#......#....A....#',
      '#..C.....B........#....#',
      '#.....#......#....#....#',
      '#....A....C.......#...E#',
      '########################',
    ],
    guards: [
      { waypoints: [[11, 2], [11, 12]], pause: 1.6 },
      { waypoints: [[19, 12], [19, 2]], pause: 1.6 },
    ],
  },
  {
    name: 'The Vault Wing',
    sub: 'Three guards, tighter halls. The vault relic sits in the open.',
    par: 100,
    pebbles: 3,
    guardSpeed: 1.08,
    coneRange: 1.06,
    map: [
      '########################',
      '#P......#.......#.....E#',
      '#.......#...A...#..C...#',
      '#..B..............B....#',
      '#.......#..C....#......#',
      '#..C....#.......#..B...#',
      '#.......#....B..#......#',
      '####.#######.#######.###',
      '#.......#.......#......#',
      '#..B....#...C...#..C...#',
      '#.......#.......#......#',
      '#......C...........A...#',
      '#.......#..B....#......#',
      '#....A..#.......#...B..#',
      '########################',
    ],
    guards: [
      { waypoints: [[12, 1], [12, 6]], pause: 1.2 },
      { waypoints: [[20, 13], [20, 8]], pause: 1.2 },
      { waypoints: [[4, 8], [4, 13]], pause: 1.4 },
    ],
  },
  {
    name: 'The Rooftop Garden',
    sub: 'Four guards under the lamps. Bushes hide you; the light does not.',
    par: 120,
    pebbles: 4,
    guardSpeed: 1.16,
    coneRange: 1.12,
    map: [
      '########################',
      '#P......#...S...#..A...#',
      '#..B....#...S...#......#',
      '#......S.......B.......#',
      '#..C....#...S...#..B...#',
      '#.......#...S...#......#',
      '#..B....#.......#..C...#',
      '####.#######.#######.###',
      '#.......#.......#..S...#',
      '#..C....#..B.A..#..S...#',
      '#.......#.......#..S...#',
      '#...B........A....S....#',
      '#.......#..C....#..S...#',
      '#..B....#.......#..S..E#',
      '########################',
    ],
    guards: [
      { waypoints: [[12, 1], [12, 6]], pause: 1.0 },
      { waypoints: [[19, 8], [19, 13]], pause: 1.0 },
      { waypoints: [[2, 8], [2, 13]], pause: 1.2 },
      { waypoints: [[18, 2], [21, 2], [21, 5], [18, 5]], pause: 1.0 },
    ],
  },
];

// Parse one level definition into the runtime structures the game uses.
// Returns tiles (solid / bush / shadow grids), the player start in pixels,
// the exit, the artifacts and the guards' spawn points.
export function parseLevel(def) {
  const rows = def.map.length;
  const cols = def.map[0].length;
  const solid = [];
  const bush = [];
  const shadow = [];
  const artifacts = [];
  let playerStart = null;
  let exit = null;

  for (let r = 0; r < rows; r++) {
    solid.push([]);
    bush.push([]);
    shadow.push([]);
    for (let c = 0; c < cols; c++) {
      const ch = def.map[r][c] || '#';
      solid[r][c] = ch === '#' || ch === 'C';
      bush[r][c] = ch === 'B';
      shadow[r][c] = ch === 'S';
      const cx = (c + 0.5) * 40;
      const cy = (r + 0.5) * 40;
      if (ch === 'P') playerStart = { x: cx, y: cy };
      if (ch === 'E') exit = { x: cx, y: cy };
      if (ch === 'A') artifacts.push({ x: cx, y: cy, taken: false });
    }
  }

  const guards = def.guards.map((g) => ({
    waypoints: g.waypoints.map(([tx, ty]) => ({
      x: (tx + 0.5) * 40,
      y: (ty + 0.5) * 40,
    })),
    pause: g.pause,
  }));

  return { rows, cols, raw: def.map, solid, bush, shadow, artifacts, playerStart, exit, guards };
}

// Tile helpers used by movement, sight and rendering.
export function tileAt(level, px, py) {
  const c = Math.floor(px / 40);
  const r = Math.floor(py / 40);
  return { c, r };
}

export function isSolidTile(level, c, r) {
  if (c < 0 || r < 0 || c >= level.cols || r >= level.rows) return true;
  return level.solid[r][c];
}

export function isBushTile(level, c, r) {
  if (c < 0 || r < 0 || c >= level.cols || r >= level.rows) return false;
  return level.bush[r][c];
}

export function isShadowTile(level, c, r) {
  if (c < 0 || r < 0 || c >= level.cols || r >= level.rows) return false;
  return level.shadow[r][c];
}

// A circle (the player or a guard) may stand here only if no solid tile
// overlaps it. Used for movement and for validating patrol routes.
export function circleHitsSolid(level, x, y, radius) {
  const c0 = Math.floor((x - radius) / 40);
  const c1 = Math.floor((x + radius) / 40);
  const r0 = Math.floor((y - radius) / 40);
  const r1 = Math.floor((y + radius) / 40);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!isSolidTile(level, c, r)) continue;
      const nx = Math.max(c * 40, Math.min(x, c * 40 + 40));
      const ny = Math.max(r * 40, Math.min(y, r * 40 + 40));
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

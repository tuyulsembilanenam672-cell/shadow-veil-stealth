# shadow-veil-stealth

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/tuyulsembilanenam672-cell/shadow-veil-stealth/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/tuyulsembilanenam672-cell/shadow-veil-stealth/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

Shadow Veil is a complete top-down stealth game that plays offline in a desktop browser. You are a hooded infiltrator slipping through a night museum: steal every relic, dodge the guards' vision cones, and reach the glowing exit unseen. Three levels — The Gallery, The Vault Wing, The Rooftop Garden — with more guards, longer cones and tighter halls each time.

Guards patrol waypoints and scan the halls. Step into a cone and suspicion climbs; hold it and the guard gives chase. Break line of sight behind a wall or a crate, melt into a bush or a patch of shadow, or throw a pebble (click the floor) to send a guard off to investigate the noise. Sneak with Shift to move slower and quieter. Steal all the relics to open the exit, beat the par time for a bonus, and finish a level without ever being spotted for a ghost bonus.

Everything is drawn procedurally on canvas and every sound is synthesized with WebAudio: no images, fonts, or audio files are loaded, and the game makes no network requests at runtime.

## Run it

Serve `game/` with any static file server, then open `index.html` in desktop Chrome:

```sh
cd game && python3 -m http.server 8080
```

Then open http://localhost:8080 in desktop Chrome.

## How to play

- Move: WASD or arrow keys. Sneak: hold Shift (slower, harder to spot).
- Distract: click the floor to throw a pebble — the nearest guard walks over to look.
- Hide: bushes block sight and shadow slows detection; walls and crates block both.
- Steal every relic (walk over it) to open the exit, then walk into the glowing door.
- Pause: P · Mute: M · Restart level: R · Three lives per run.

## Hand-in

`main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=sq78y28z&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>

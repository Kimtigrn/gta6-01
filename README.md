# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Kimtigrn/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Kimtigrn/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is an open-world crime game that runs in a desktop browser from
static files, with no network request. You are Rio Vega, a driver-for-hire in
a sun-soaked coastal city, running five story jobs for fixer Mara Solano:
pick up clients, steal cars, settle scores, outrun the police and pull off
the Big Score. The city is yours to explore on foot and by car, with traffic
and pedestrians on every street, cars to steal, a five-star wanted level with
police cars and officers who hunt you down, pistol combat, cash pickups, a
minimap, a save in localStorage, and synthesized WebAudio sound.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 and press Enter. No build step, no
dependencies: `game/index.html` and its ES modules are plain static files.
WASD to move and drive, mouse to aim, click to shoot, E to enter or leave a
car, Shift to sprint, Space to brake, P to pause, M to mute.

## What it does

`game/src/` is split into one file per system: `city.js` generates the road
grid, buildings, parks and beach; `player.js` walks and drives; `traffic.js`
runs traffic cars and pedestrians; `police.js` runs the wanted level and the
chase; `combat.js` runs shooting, gunmen, bullets and pickups; `missions.js`
holds the five-job story; `world.js` steps the whole simulation; `render.js`
draws the city, the HUD and the minimap; `audio.js` synthesizes every sound;
`save.js` keeps the story in localStorage; `shots.js` stages the four
screenshot scenes deterministically (`?shot=chase|mission|foot|start`).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

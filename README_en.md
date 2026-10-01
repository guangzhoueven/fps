# NEON SIEGE

<p align="center">
  <a href="/README_en.md">English</a> | <a href="/README.md">中文</a>
</p>

<p align="center">
  <a href="https://github.com/guangzhoueven/fps/actions/workflows/release.yml">
    <img alt="Build & Release" src="https://github.com/guangzhoueven/fps/actions/workflows/release.yml/badge.svg" />
  </a>
  <img alt="Language" src="https://img.shields.io/badge/language-JavaScript-F7DF1E?logo=javascript&logoColor=black" />
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r160-black?logo=threedotjs&logoColor=white" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white" />
</p>
<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/guangzhoueven/fps?style=social" />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/guangzhoueven/fps?style=social" />
  <img alt="GitHub watchers" src="https://img.shields.io/github/watchers/guangzhoueven/fps?style=social" />
</p>
<p align="center">
  <a href="https://www.star-history.com/?repos=guangzhoueven%2Ffps&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=guangzhoueven%2Ffps&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=guangzhoueven%2Ffps&type=date&theme=light&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=guangzhoueven%2Ffps&type=date&theme=light&legend=top-left" />
  </picture>
  </a>
</p>
<p align="center">
  <a href="http://guangzhoueven.github.io/fps"><b>Play now</b></a>
</p>



---

# NEON SIEGE 霓虹围城

> Hold the line. Outlast the swarm.

**An original wave-survival FPS** — a Three.js first-person shooter that runs entirely in the browser with zero build step, plus a Windows desktop build (Electron) and one-click releases via GitHub Actions.

## Features

- **Endless waves**: enemy count and strength scale every wave, with periodic Boss waves
- **8 weapons**: pistol, SMG, shotgun, rifle, sniper, rocket launcher, crossbow, minigun — each with distinct damage / spread / recoil / fire-rate stats, purchasable in-game
- **7 enemy types**: Grunt, Runner, Brute, Shooter, Phantom, Tank and the Boss — each with its own AI behavior
- **B\* pathfinding**: custom B\* grid pathfinding (automatic A\* fallback), so enemies steer around obstacles and chase you through doors
- **Perks & achievements**: pick 1 of 3 perks after clearing each wave (10 perks), plus 5 achievement challenges
- **Combo system**: headshots, combo multipliers, score popups, chain-reacting barrels
- **Supplies**: shop, medkits, ammo, grenades, supply crates, power-ups (speed / double damage / rapid fire / shield)
- **Full save system**: autosave, continue, export/import JSON backups, undoable soft-clear
- **Bilingual UI**: real-time English / Chinese switching
- **Atmosphere**: dynamic day/night sky, pointer-lock look, sprint / crouch / jump / flashlight, minimap, weapon stats panel
- **Revive**: get back on your feet with 5 seconds of invincibility

## Controls

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `W` `A` `S` `D` | Move | `Left Mouse` | Fire |
| `Mouse` | Look | `Right Mouse` | Aim (ADS) |
| `Shift` | Sprint | `Ctrl` | Crouch |
| `Space` | Jump | `R` | Reload |
| `E` | Interact / open doors | `F` | Flashlight |
| `G` | Grenade | `Q` / `Wheel` | Cycle weapons |
| `1`–`5` | Weapon slots | `Tab` | Weapon stats |
| `Esc` | Pause | | |

## Getting Started

### Play online

Visit **[fps.gzeven.cc.cd](https://fps.gzeven.cc.cd)** in any modern desktop browser (the first click requests pointer lock).

### Run locally

```bash
git clone https://github.com/guangzhoueven/fps.git
cd fps

# Zero build step — serve with any static server, e.g.:
npx serve .
# or
python -m http.server 8080
```

Or launch the Electron desktop window directly:

```bash
npm ci
npm start
```

### Build the Windows installers

```bash
npm ci
npm run dist
# Outputs dist/NeonSiege-Setup-1.0.0.exe (installer) and NeonSiege-Portable-1.0.0.exe (portable)
```

Pushing a `v*` tag automatically triggers GitHub Actions (`windows-latest`) to build and publish the exes to [Releases](https://github.com/guangzhoueven/fps/releases).

## Tech Stack

- [Three.js](https://threejs.org) r160 (vendored locally, no external dependencies)
- Vanilla JavaScript classic `<script>` modules (**no bundler, no framework**)
- Electron 33 + electron-builder 25
- GitHub Actions for automated builds & releases
- Saves: browser `localStorage`

## Project Structure

```
fps/
├── index.html              # Entry page
├── css/style.css           # Styles
├── js/                     # Game modules
│   ├── engine.js           #   Rendering / lights / camera
│   ├── world.js            #   Map, rooms, doors
│   ├── navigation.js       #   Nav grid + B*/A* pathfinding
│   ├── player.js           #   Movement / damage / revive
│   ├── enemies.js          #   Enemy AI
│   ├── waves.js            #   Waves & spawn queue
│   ├── weapons.js          #   Firing / projectiles
│   ├── shop.js, hud.js     #   Shop & HUD
│   ├── save.js             #   Save system
│   └── ...                 #   Audio, effects, items, input, i18n
├── js/vendor/three.min.js  # Three.js r160
├── translations/           # zh.json / en.json
├── electron-main.js        # Electron shell
└── .github/workflows/      # Auto-release
```

## Save Data

Progress is autosaved to browser `localStorage` (key: `neonSiegeSave`). The pause menu offers:

- **Export data**: download a JSON backup
- **Import data**: restore from a backup
- **Clear data**: double confirmation with an undo toast, to prevent accidental deletion

## Contributing

Issues and pull requests are welcome.

---

<p align="center">
  An original work · Made by <a href="https://github.com/guangzhoueven">guangzhoueven</a> and <a href="https://github.com/starlightfootprint">StarlightFootprint</a>
</p>

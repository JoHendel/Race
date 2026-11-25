# Changelog

## Unreleased
- New track **Glacier Rift**: ice patches with less grip, an ice cave and northern lights – the Neon Cup now has four tracks
- Tracks can define surfaces (grip) and their own environment (sky, fog, scenery)
- Track selection on the title screen and for the host in the online lobby
- **Shortcut** through a warehouse on Neon Harbor – laps through it count only when you really drive through; shown dashed on the minimap

## v0.8.0 – Submission release
- German/English UI toggle (remembered in the browser, `?lang=de|en`)
- Architecture documentation with module, data-flow and pipeline diagrams (`docs/architecture.md`)
- README section "How the AI was built (CRISP-DM)", English screenshots
- `CONTRIBUTING.md` and issue templates; all public documentation in English
- More robust online end-to-end test on slow CI runners

## v0.7.0 – AI driver, part 2
- Stage 2 training: evolution strategy (`pnpm ai:evolve`) on top of behavior cloning
- APEX-AI v2 is 5.5 % faster than the rule-based bots on an unseen track
- APEX-AI joins every race, offline and online, with its own livery and AI markers on the minimap and results
- Report: v1 vs v2 vs rule-based bot, evolution curve; CRISP-DM phases 5–6 documented

## v0.6.0 – AI driver, part 1
- Headless simulation package (`packages/sim`) shared by the game and AI training
- New tracks: Sunset Canyon, Skyline Loop, Grand Circuit
- APEX-AI pipeline (`packages/ai`): telemetry recording, own MLP, behavior cloning with early stopping, evaluation and data analysis report
- Documentation of the AI development along CRISP-DM (`docs/ai-driver.md`, `docs/ai/report.md`)

## v0.5.0 – Garage
- 12 cars in 4 classes, each with its own body shape
- XP, levels and credits; cars unlock by level or by winning a Grand Prix
- Performance and visual tuning, performance index, local save game

## v0.4.0 – Podium & Grand Prix
- 3D podium with trophy, confetti, fireworks and a camera orbit
- Awards: fastest lap, drift king, most overtakes, comeback of the race
- Grand Prix mode with 4 races, overall standings and a cup ceremony

## v0.3.0 – Online multiplayer
- Online races for up to 10 players via room code or link, peer-to-peer without a server
- Lobby with names, ready status, lap count and bot fill
- Rejoin after a disconnect; a bot drives the car in the meantime

## v0.2.0 – First race
- Neon Harbor track with a jump and harbor scenery
- 9 bots, 3 laps, countdown with perfect start, minimap, positions
- Slow-motion finish and results table with points

## v0.1.0 – Driving feel
- Test drive on a neon test ground with physics, jumps and cones
- Drift with three boost stages, nitro, reset
- Chase camera, HUD with speedometer and nitro bar

## v0.0.1 – Foundation
- Project structure, build, tests and automatic deployment to GitHub Pages
- Animated neon title screen

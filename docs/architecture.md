# Architecture

APEX RUSH is a TypeScript monorepo (pnpm workspaces) with five packages. Each package has one job and a small public interface (`src/index.ts`); no package reaches into the internals of another. Everything runs in the browser – there is no game server – and the same simulation code also runs headless in Node for AI training.

## Module overview

```mermaid
flowchart TB
  subgraph browser["Browser (GitHub Pages)"]
    client["<b>client</b><br/>rendering (Three.js), HUD, menus,<br/>garage, podium, input, i18n, audio"]
  end
  subgraph core["Shared core (browser + Node)"]
    ai["<b>ai</b><br/>APEX-AI: observation, MLP,<br/>training, evolution, report"]
    sim["<b>sim</b><br/>physics (Rapier), track geometry,<br/>rule-based bots, headless race"]
    net["<b>net</b><br/>P2P transport (PeerJS/WebRTC),<br/>protocol, interpolation"]
    shared["<b>shared</b><br/>game data and rules: cars, tuning,<br/>tracks, laps, scoring, progress, texts"]
  end
  client --> ai
  client --> sim
  client --> net
  client --> shared
  ai --> sim
  ai --> shared
  sim --> shared
```

Arrows point from a package to the packages it imports. `sim` also offers `@apex/sim/pure` (wheel layout, seeded random) without the physics engine, so menus and the garage do not load Rapier; the race scene and Rapier are a separately loaded chunk (`client/game/engine.ts`). `shared` and `net` depend on no other package, so the dependency graph has no cycles.

| Package | Responsibility | Main public interface | External libraries |
| --- | --- | --- | --- |
| `shared` | Pure game data and rules, no rendering, no physics | `CARS`, `statsFor`, `performanceIndex`, `TRACKS`, `LapTracker`, `rankRacers`, `CupStandings`, `computeAwards`, `SaveGame`, `translate`, ghost/replay encoding, `RivalBook`, audio maths and `SONGS` | – |
| `net` | Peer-to-peer networking and message format | `HostMessage` / `ClientMessage`, `HostTransport` / `ClientTransport`, `SignalingProvider` (`PeerSignaling`, `LocalSignaling`), `SnapshotBuffer` | PeerJS |
| `sim` | Physics and race logic without graphics | `VehiclePhysics`, `TrackGeometry`, `BotDriver`, `HeadlessRace`, `ControlState` | Rapier (WASM), Three.js math |
| `ai` | The machine-learning driver and its pipeline | `observe`, `Mlp`, `AiDriver`, `CURRENT_MODEL`, `trainModel`, `evolve`, `evaluateModel`, `buildReport` | – |
| `client` | The game in the browser | entry point `main.ts` (menu, scenes, online sessions), `audio/sound.ts` (all sound) | Three.js, Rapier, WebAudio |

Game values (car stats, points, lap limits, colors) live as configuration in `shared`, not scattered through the code. Tracks are data as well: a closed spline plus ramps, surface zones (e.g. ice), shortcuts, dynamic events (e.g. a drawbridge that rises from lap 2) and an environment description; `sim` turns them into road, walls, colliders and a `locate()` function that follows cars along the main track or through a shortcut.

## How the game and the AI share one simulation

```mermaid
flowchart LR
  subgraph game["In the browser"]
    car["client Car<br/>(VehiclePhysics + 3D mesh)"]
    track["SplineTrack<br/>(TrackGeometry + visuals)"]
    aid["AiDriver"]
  end
  subgraph train["In Node (pnpm ai:*)"]
    hr["HeadlessRace"]
  end
  vp["sim: VehiclePhysics"] --> car
  tg["sim: TrackGeometry"] --> track
  vp --> hr
  tg --> hr
  model[("models/apex-ai-v2.json")] --> aid
  hr -- "telemetry, fitness" --> model
```

The client classes `Car` and `SplineTrack` extend the headless classes from `sim` and only add meshes. Because of this the AI is trained on exactly the physics the player drives with.

## Online multiplayer (host-authoritative peer-to-peer)

```mermaid
sequenceDiagram
  participant C as Client browser
  participant S as PeerJS broker (free, public)
  participant H as Host browser
  H->>S: register room code
  C->>S: look up room code
  S-->>C: WebRTC connection to host
  C->>H: hello (name, car)
  H-->>C: welcome + lobby state
  Note over H: host starts the race,<br/>simulates bots and APEX-AI
  loop 30 times per second
    C->>H: own car state (client drives locally)
    H-->>C: snapshot (all cars, laps, places)
  end
  Note over C: other cars are interpolated<br/>about 100 ms in the past
```

- The broker is only used to find each other; game data goes directly between the browsers.
- The host decides lap counting, places and the end of the race. Bots and APEX-AI run on the host.
- If a client drops out, a bot drives its car; the player can rejoin within 30 seconds.
- `LocalSignaling` (BroadcastChannel) replaces the broker in the automated tests (`?net=local`).

## Audio (procedural, no sound files)

```mermaid
flowchart LR
  subgraph sharedA["shared (pure, unit-tested)"]
    gear["engineRpm / engineVoice<br/>5-gear box, voice per car class"]
    mix["squealGain, distanceGain,<br/>AudioSettings"]
    seq["SONGS + stepEvents<br/>16-step sequencer"]
  end
  subgraph clientA["client/audio/sound.ts (WebAudio)"]
    eng["EngineSound loops<br/>player + 3 nearest cars"]
    fx["one-shots: boost, items,<br/>countdown, laps, horn, UI"]
    music["Music: lookahead scheduler<br/>menu → race → final lap"]
    bus(("master gain<br/>volume / mute"))
  end
  gear --> eng
  mix --> eng
  mix --> fx
  seq --> music
  eng --> bus
  fx --> bus
  music --> bus
```

Every sound is synthesised from oscillators and filtered noise, so there is nothing to download and no licence to check. The audio context starts on the first click or key press (browser autoplay rules). The rules (gearbox, mixing, song patterns) live in `shared` and are unit-tested; the client only turns them into WebAudio nodes.

## AI pipeline

```mermaid
flowchart LR
  rec["ai:record<br/>bots race headless,<br/>24 features + 4 actions"] --> data[("telemetry<br/>280k samples")]
  data --> bc["ai:train<br/>behavior cloning<br/>(Adam, early stopping)"]
  bc --> v1[("apex-ai-v1.json")]
  v1 --> es["ai:evolve<br/>evolution strategy<br/>(race fitness)"]
  es --> v2[("apex-ai-v2.json")]
  v2 --> ev["ai:evaluate<br/>unseen test track"]
  v1 --> ev
  ev --> rep["ai:report<br/>docs/ai/report.md"]
  v2 --> game["game: APEX-AI<br/>in every race"]
```

The AI is trained on `forTraining()` variants of the tracks (no shortcuts, no dynamic events), so new track features never change the recorded data – `pnpm ai:evaluate` stays bit-identical.

Details and all numbers: [ai-driver.md](ai-driver.md) (CRISP-DM) and [ai/report.md](ai/report.md).

## Build, tests and deployment

| Step | Tool | Where |
| --- | --- | --- |
| Lint | ESLint (flat config) | every push |
| Type check | TypeScript strict | every push |
| Unit tests | Vitest (rules, physics helpers, networking, AI math, i18n) | every push |
| Build | Vite (static files, base path `/Race/`) | every push |
| End-to-end tests | Playwright: language toggle, sound settings, track/weather choice, test drive, full race with replay and highlights, time trial and drift challenge, host + client online race (horn/emotes), spectator, track vote with chaos mode | every push |
| Deployment | GitHub Actions publishes the build to the `gh-pages` branch | push to `main` |

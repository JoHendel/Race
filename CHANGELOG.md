# Changelog

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
- 12 Fahrzeuge in 4 Klassen mit eigenen Karosserien
- XP, Level, Credits, Freischalten per Level oder Grand-Prix-Sieg
- Leistungs- und Optik-Tuning, Leistungsindex, Speicherstand

## v0.4.0 – Siegertreppe & Grand Prix
- 3D-Siegertreppe mit Pokal, Konfetti, Feuerwerk und Kamerafahrt
- Auszeichnungen: Schnellste Runde, Drift-König, Meiste Überholungen, Comeback
- Grand-Prix-Modus mit 4 Rennen, Gesamtwertung und Cup-Siegerehrung

## v0.3.0 – Online-Multiplayer
- Online-Rennen für bis zu 10 Spieler per Raumcode oder Link, Peer-to-Peer ohne Server
- Lobby mit Namen, Bereit-Status, Rundenzahl, Bot-Auffüllung
- Wiedereinstieg nach Verbindungsabbruch, Bot übernimmt so lange

## v0.2.0 – Erstes Rennen
- Strecke Neon Harbor mit Sprungkante und Hafen-Kulisse
- 9 Bots, 3 Runden, Countdown mit Perfektstart, Minimap, Platzierung
- Zieleinlauf in Zeitlupe und Ergebnistabelle mit Punkten

## v0.1.0 – Fahrgefühl
- Testfahrt auf einem Neon-Testgelände mit Physik, Sprüngen und Pylonen
- Drift mit drei Boost-Stufen, Nitro, Reset
- Verfolgerkamera, HUD mit Tacho und Nitro-Leiste

## v0.0.1 – Fundament
- Projektstruktur, Build, Tests und automatischer Deploy auf GitHub Pages
- Animierter Neon-Titelbildschirm

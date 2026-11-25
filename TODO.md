# TODO

## M1 – Fahrgefühl
- [x] alles erledigt (siehe PROGRESS.md)
- [ ] Später (M9): Fahrwerte mit echtem Gamepad nachjustieren

## M2 – Rennen allein
- [x] alles erledigt (siehe PROGRESS.md)

## M3 – Multiplayer
- [x] PeerJS, Lobby, Raumcode/Link, Host-Simulation, Snapshots, Interpolation, Reconnect, E2E-Test mit 2 Fenstern
- [ ] Host-Wechsel (Zustand an den Spieler mit dem besten Ping übergeben)
- [ ] Ping-Anzeige in der Lobby

## M4 – Siegertreppe & Wertung
- [x] Podest, Pokal, Konfetti, Feuerwerk, Kamerafahrt, Emotes, Auszeichnungen, Grand Prix offline
- [ ] Grand Prix online (Host-Einstellung „Modus“)
- [ ] Emotes online synchronisieren

## M5 – Garage
- [x] 12 Autos, Karosserien, XP/Credits/Level, Freischalten, Tuning, Optik, Speicherstand, Auto in der Lobby
- [ ] PI-Limit als Schalter in der Lobby

## M6 – KI-Fahrer, Teil 1 (Daten & Modell)
- [ ] `packages/sim`: Car-Physik, Strecke (Kollision ohne Grafik), LapTracker, Bots headless in Node
- [ ] 2 weitere Strecken vorziehen (Sunset Canyon, Grand Circuit) für Training/Test
- [ ] Beobachtungsvektor + Normierung in `packages/ai`
- [ ] `pnpm ai:record`: Telemetrie der Regel-Bots als Datensatz
- [ ] MLP in TypeScript + Behavior Cloning (`pnpm ai:train`)
- [ ] `pnpm ai:report`: Datenanalyse-Parameter als Markdown + Diagramme
- [ ] `docs/ai-driver.md` Phasen 1–4 mit echten Zahlen

## M7 – KI-Fahrer, Teil 2
- [ ] Feinschliff per Evolutionsstrategie/RL, Auswertung auf ungesehener Strecke
- [ ] APEX-AI immer im Startfeld (offline + online), Kennzeichnung im HUD/Ergebnis
- [ ] `docs/ai-driver.md` Phasen 5–6

## M8 – Abgabe-Release (bis 18.12.2026)
- [ ] Gesamte Doku Englisch (PROGRESS/DECISIONS bleiben interne Notizen)
- [ ] Architektur-Diagramm, UI-Sprachumschalter DE/EN
- [ ] Release v0.8.0

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
- [x] sim-Paket, 3 neue Strecken, Beobachtung, Aufzeichnung, MLP + Behavior Cloning + Early Stopping, Report, Doku Phasen 1–4

## M7 – KI-Fahrer, Teil 2
- [ ] `pnpm ai:evolve`: Evolutionsstrategie (z. B. OpenAI-ES mit antithetischen Stichproben) ab apex-ai-v1, Belohnung Fortschritt/Zeit, Strafe Mauer/Reset/falsche Richtung, Nitro lernen
- [ ] Lernkurve der Belohnung im Report, Vergleich v1 vs. v2 auf der Teststrecke
- [ ] Inferenzzeit im Browser messen (< 0,2 ms)
- [ ] APEX-AI immer im Startfeld (offline + online), Kennzeichnung im HUD/Ergebnis
- [ ] `docs/ai-driver.md` Phasen 5–6

## M8 – Abgabe-Release (bis 18.12.2026)
- [ ] Gesamte Doku Englisch (PROGRESS/DECISIONS bleiben interne Notizen)
- [ ] Architektur-Diagramm, UI-Sprachumschalter DE/EN
- [ ] Release v0.8.0

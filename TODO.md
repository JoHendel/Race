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
- [x] `pnpm ai:evolve`: Evolutionsstrategie (z. B. OpenAI-ES mit antithetischen Stichproben) ab apex-ai-v1, Belohnung Fortschritt/Zeit, Strafe Mauer/Reset/falsche Richtung, Nitro lernen
- [x] Lernkurve der Belohnung im Report, Vergleich v1 vs. v2 auf der Teststrecke
- [x] Inferenzzeit im Browser messen (< 0,2 ms)
- [x] APEX-AI immer im Startfeld (offline + online), Kennzeichnung im HUD/Ergebnis
- [x] `docs/ai-driver.md` Phasen 5–6

- [ ] Später: Schwierigkeit von APEX-AI über Leistungsanteil (Motorleistung), Nitro über längeren Fitness-Test/Überhol-Belohnung lernen

## M8 – Abgabe-Release (bis 18.12.2026)
- [x] Gesamte Doku Englisch (README, docs/, CHANGELOG, CONTRIBUTING, CREDITS, Issue-Vorlagen; PROGRESS/DECISIONS/TODO bleiben interne Notizen)
- [x] UI-Sprachumschalter DE/EN (Wörterbuch in packages/shared, MutationObserver im Client)
- [x] Architektur-Diagramm (README + docs/architecture.md, Mermaid)
- [x] README-Abschnitt „How the AI was built (CRISP-DM)“, englische Screenshots
- [x] Release v0.8.0 (Version + Changelog; Tag nur lokal, GitHub-Release siehe BLOCKERS.md)
- [ ] Menschlich: Pages einschalten, Release anlegen, Link bis 18.12.2026 abgeben (BLOCKERS.md)

## M9 – Alle Strecken
- [x] Streckenformat: Untergrund-Zonen (`surfaces`, Grip-Faktor) und Umgebung (`environment`: Himmel, Nebel, Kulisse, Polarlichter)
- [x] Glacier Rift: 2 Eisflächen (Grip 0,55), Eishöhle, Eisspitzen, Polarlichter; Neon Cup jetzt vollständig (4 Strecken)
- [x] Bots bremsen auf Eis früher; Physik nutzt den Grip in Spiel und Headless-Simulation
- [x] Streckenwahl im Titelmenü (Pfeile, gespeichert, `?track=`), Streckenwahl des Hosts in der Lobby
- [x] Abkürzungen: eigener Spline-Abschnitt mit Mauerlücke, Gutschrift der Checkpoints nur bei Durchfahrt (`creditShortcut`), Lagerhalle in Neon Harbor (spart ca. 0,65 s), gestrichelt auf der Minimap
- [ ] Abkürzungen für die übrigen Strecken (Sunset Canyon nach dem Steinschlag, Skyline Loop, Glacier Rift, Grand Circuit Boxengasse)
- [x] Dynamisches Ereignis Zugbrücke Neon Harbor: zwei kinematische Klappen, heben sich ab Runde 2 auf 10° (Buckel-Sprung), Türme mit Warnlichtern, Banner; online aus der Rundenzahl des Führenden
- [ ] Steinschlag Sunset Canyon (gibt eine Abkürzung frei)
- [ ] Turbo Cup: Jungle Ruins, Volcano Rush, Orbital Station (geringe Schwerkraft)
- [ ] Streckenwahl per Abstimmung in der Lobby (3 zufällige Strecken, Glücksrad bei Gleichstand)
- [ ] Rundenzeiten auf 45–75 s bringen (aktuell ca. 35–45 s für schnelle Fahrer)

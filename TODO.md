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
- [ ] Abkürzungen für die übrigen Strecken (Skyline Loop, Glacier Rift, Grand Circuit Boxengasse) und je ein Ereignis für Skyline Loop, Glacier Rift, Grand Circuit
- [x] Dynamisches Ereignis Zugbrücke Neon Harbor: zwei kinematische Klappen, heben sich ab Runde 2 auf 10° (Buckel-Sprung), Türme mit Warnlichtern, Banner; online aus der Rundenzahl des Führenden
- [x] Steinschlag Sunset Canyon: Felssperre schließt die Schlucht-Abkürzung, ab Runde 2 stürzen Brocken herab, Sperre bricht zusammen (Staubwolke), Abkürzung frei (spart ca. 0,65 s); Minimap rot/orange
- [x] Jungle Ruins (Turbo Cup): Achter-Layout, Wasserfall-Durchfahrt, Hangbrücke, Sprung, Tempel-Abkürzung (stürzt ab Runde 2 ein, spart ca. 0,4 s), eigene Dschungel-Kulisse mit Stufenpyramide
- [x] Volcano Rush (Turbo Cup): Spirale um den Vulkan, 3 Lavafelder auf je einer Fahrbahnhälfte (starke Bremswirkung), wechseln jede Runde die Seite; Lavatunnel-Abkürzung (ca. 0,9 s), Sprung; Bots weichen aus und driften nicht neben Lava
- [x] Orbital Station (Turbo Cup): Dreieck mit zwei langen Sprüngen, Schwerkraft 4,2 m/s² (am Boden normaler Anpressdruck), Glasröhren-Abkürzung, Raumstations-Kulisse; Looping bewusst weggelassen (DECISIONS.md)
- [x] Grand Prix spielt den Cup der gewählten Strecke (Neon Cup / Turbo Cup), Cup-Name in der Streckenwahl
- [ ] APEX-AI kennt Lava/Eis nicht (kein Merkmal) – Kandidat für ein v3-Training mit Untergrund-Merkmal
- [ ] Streckenwahl per Abstimmung in der Lobby (3 zufällige Strecken, Glücksrad bei Gleichstand)
- [ ] Rundenzeiten auf 45–75 s bringen (aktuell ca. 35–45 s für schnelle Fahrer)

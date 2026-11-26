# Fortschritt

**Nächster Schritt:** M11 starten – Wetter & Nacht: `Weather` ("clear" | "rain" | "fog" | "night") in `packages/shared`, Regen senkt Grip (Faktor wie Eis, für alle Fahrer gleich), Regen-Partikel + nasse Fahrbahn im Client, Nebel über Fog-Distanz, Nacht mit Scheinwerfer-SpotLights; Auswahl im Titelmenü und in der Lobby (Host), online in `LobbySettings`.

| Meilenstein | Status |
| --- | --- |
| M0 – Fundament | ✅ fertig (`v0.0.1`) |
| M1 – Fahrgefühl | ✅ fertig (`v0.1.0`) |
| M2 – Rennen allein | ✅ fertig (`v0.2.0`) |
| M3 – Multiplayer | ✅ fertig (Host-Wechsel offen) |
| M4 – Siegertreppe & Wertung | ✅ fertig |
| M5 – Garage | ✅ fertig |
| M6 – KI-Fahrer, Teil 1 (Daten & Modell) | ✅ fertig |
| M7 – KI-Fahrer, Teil 2 (Training, Evaluation, Einbau) | ✅ fertig |
| M8 – Abgabe-Release (spätestens 18.12.2026) | ✅ fertig (Pages/Release brauchen den Menschen, siehe BLOCKERS.md) |
| M9 – Alle Strecken | ✅ fertig |
| M10 – Grafik & Assets | ✅ fertig |
| M11 – Extra-Features | ⏳ als Nächstes |
| M12 – Sound & Feinschliff | offen |
| M13 – Release v1.0 | offen |
## Berichte

### M0 – Fundament
pnpm-Monorepo mit `client`, `net` und `shared`, TypeScript strict, ESLint, Vitest (Wertung, Raumcode), Playwright-Smoke-Test, GitHub Actions mit Deploy auf den Branch `gh-pages`, README, MIT-Lizenz und alle Projektdateien. Der Titelbildschirm zeigt eine animierte Neon-Fahrbahn mit Bloom.

### M1 – Fahrgefühl
Rapier-Raycast-Fahrzeug mit tiefem Schwerpunkt, Federung und Abtrieb. Drift mit Drehraten-Regelung (kein Kreiseln), drei Boost-Stufen mit Funken und Kamerastoß, Nitro-Tank, der durch Drifts lädt, Reset per Taste sowie automatisch nach 2 s auf dem Dach oder beim Herunterfallen. Verfolgerkamera mit Federung und tempoabhängigem Sichtfeld. HUD mit Tacho, Nitro-Leiste, Drift-Anzeige. Testgelände mit Slalom, Pylonenkreis, zwei Rampen und Neon-Himmel.

Gemessen in der automatischen Testfahrt: 0–100 km/h in ca. 4,3 s, Sprung über die Rampe mit sauberer Landung, Drift um ca. 90° mit Boost danach, Bremsen aus 100 km/h in ca. 2 s.

### M2 – Rennen allein
Spline-Streckengenerator (Fahrbahn, Randsteine, Seitenstreifen, Mauern mit Neonkante, Trimesh-Kollision, Startportal, Kulisse aus Lagerhallen), Neon Harbor mit ca. 1,4 km und Sprungkante. Rennablauf: Kameraflug-Intro (überspringbar), Countdown 3-2-1-GO mit Perfektstart und Frühstart-Strafe, Rundenzählung mit 24 Checkpoints (Abkürzen zählt nicht), Falsche-Richtung-Warnung, Platzierung, Zeiten, Minimap, FINAL-LAP-Ansage, Zeitlupe beim Zieleinlauf, 30 s Restzeit, Live-Ergebnistabelle mit Punkten und schnellster Runde, Revanche und Menü. 9 Bots mit eigener Spur, Kurvenbremsung, Nitro und Selbstbefreiung.

Gemessen: Runde ca. 43 s, alle 10 Fahrzeuge kommen ohne Hängenbleiben ins Ziel.

### M3 – Multiplayer
Online-Rennen für bis zu 10 Spieler per Raumcode oder Link, ohne Konto und ohne eigenen Server: PeerJS/WebRTC mit dem kostenlosen öffentlichen Vermittlungsserver, austauschbar über `SignalingProvider` (für Tests gibt es einen lokalen Vermittler über BroadcastChannel, `?net=local`). Lobby mit Namen, Farben, Bereit-Status, Rundenzahl und Bot-Auffüllung. Der Host simuliert Bots und die gesamte Rennlogik (Runden, Platz, Ziel, Ergebnis) und sendet 30 Snapshots pro Sekunde; Clients fahren ihr eigenes Auto lokal (keine Eingabeverzögerung) und sehen alle anderen interpoliert mit 100 ms Puffer. Verbindungsabbruch: Ein Bot übernimmt das Auto; beim Neuladen innerhalb von 30 s steigt der Spieler an derselben Stelle wieder ein (getestet). Nach dem Rennen geht es gemeinsam zurück in die Lobby.

**Noch offen:** Host-Wechsel. Verlässt der Host das Spiel, endet die Runde für alle mit einer Meldung. Siehe `DECISIONS.md`.

### M4 – Siegertreppe & Wertung
3D-Siegertreppe auf einer Neon-Bühne über dem Hafenwasser: Plätze 1–3 mit ihren Autos auf den Stufen, drehender Goldpokal, 900 Konfetti-Teilchen, Feuerwerk, Scheinwerfer und Kamerafahrt; Emote-Leiste für Spieler auf dem Podest. Danach Ergebnistabelle mit Auszeichnungen (Schnellste Runde, Drift-König, Meiste Überholungen, Comeback des Rennens). Grand-Prix-Modus mit 4 Rennen, Gesamtwertung nach jedem Rennen und Cup-Siegerehrung nach Gesamtwertung. Online zeigen Host und Clients die Siegertreppe gemeinsam, sobald das Ergebnis feststeht.

Offen: Grand Prix gibt es bisher nur offline; bis M6 besteht der Cup aus 4× Neon Harbor. Emotes auf dem Podest sind noch nicht online synchronisiert.

### M5 – Garage
12 Fahrzeuge in 4 Klassen mit eigenen Werten (1–10) und fünf prozeduralen Karosserieformen (Hatch, Coupé, Keil, Muscle, Hyper). Fortschritt mit XP, Level und Credits nach jedem Rennen; Autos werden per Level oder Grand-Prix-Sieg freigeschaltet. Garage mit Drehteller, Werte-Balken (Serie und getunt), Leistungsindex gegen das Klassenlimit, Leistungs-Tuning (Motor, Getriebe, Reifen, Fahrwerk, Nitro, Gewicht in je 5 Stufen, Übersetzung, Reifentyp) und Optik (Lack, Oberfläche, Felgen, Unterboden, Folie, Spoiler, Startnummer, Reifenrauch, Hupe). Spielstand in localStorage. Online bringt jeder Spieler sein Auto mit in die Lobby.

Offen: Leistungsindex-Limit als Lobby-Schalter; Hupen-Sounds und Reifenrauch-Farbe werden erst mit M8/M9 hör- und sichtbar.

### M6 – KI-Fahrer, Teil 1
`packages/sim`: Fahrzeugphysik, Strecken-Geometrie/Kollision, Regel-Bots und komplette Rennen ohne Grafik in Node (2 Runden mit 6 Autos in < 1 s Rechenzeit); das Spiel nutzt dieselben Klassen. Drei neue Strecken (Sunset Canyon, Skyline Loop, Grand Circuit) plus Spiegelung als Augmentation. `packages/ai`: 24 Merkmale (Beobachtung), eigenes MLP 24→32→32→4 mit Backprop + Adam + Early Stopping, Pipeline `pnpm ai:record|train|evaluate|report|all`. Ergebnis (Seed 2026): 280.754 Samples, Split nach Strecken, Lenkung R² 0,80 auf der Teststrecke, APEX-AI fährt auf der ungesehenen Strecke 100 % ins Ziel, 0,08 Mauerkontakte pro Runde, Rundenzeit 102,8 % des besten Regel-Bots. `docs/ai-driver.md` (Phasen 1–4 + erste Evaluation) und `docs/ai/report.md` (alle Datenanalyse-Parameter, Diagramme).

Befund: Die Regel-Bots nutzen praktisch kein Nitro – Nitro wird erst in Stufe 2 (M7) gelernt.

## Abschlussbericht M7 – KI-Fahrer, Teil 2

- Stufe 2: OpenAI-ES (`packages/ai/src/evolve.ts`, `pnpm ai:evolve`), 30 Generationen × 16 Kandidaten, 318 s. Validierungsfitness 141,3 → 154,4, Runde Skyline Loop 44,67 → 35,64 s. Bestes Modell nach Validierung → `apex-ai-v2.json`.
- Nitro-Ausgang vor Stufe 2 zurückgesetzt; ES findet Nitro zeitweise (bis 12 %), behält es aber kaum (0,6 %) – als Befund dokumentiert.
- Teststrecke Grand Circuit (ungesehen): v2 94,5 % der Bot-Rundenzeit, Ø Platz 1,2, 0,33 Mauerkontakte/Runde, 100 % Ziel. v1: 102,1 %, Ø Platz 4,0.
- APEX-AI fährt in jedem Rennen (offline eigener Startplatz, online vom Host simuliert), schwarz-goldene Lackierung, „AI“-Ring auf der Minimap, KI-Badge im Ergebnis. Inferenz im Browser 0,038 ms/Schritt.
- Report erweitert (v1/v2/Bot-Vergleich, ES-Kurve), `docs/ai-driver.md` Phasen 4–6 vollständig. Lint, 33 Unit-Tests, 3 E2E-Tests grün. Tag `v0.7.0` lokal (Tag-Push durch Proxy blockiert).

## Abschlussbericht M8 – Abgabe-Release

- UI auf Deutsch/Englisch umschaltbar (Knopf oben rechts im Titel, gespeichert, `?lang=`), Wörterbuch in `packages/shared/src/i18n.ts`, Übersetzer per MutationObserver.
- `docs/architecture.md` mit Modul-, Datenfluss-, Multiplayer- und Pipeline-Diagrammen (Mermaid), Modulgraph auch in der README.
- README: Abschnitt „How the AI was built (CRISP-DM)“ mit Kennzahlen (stimmen mit `docs/ai/report.md` überein), Online-Anleitung englisch, Screenshots neu mit englischer UI.
- `CONTRIBUTING.md`, Issue-Vorlagen, CHANGELOG und CREDITS komplett englisch. Version 0.8.0.
- Bot „Blitz“ in „Blaze“ umbenannt (wurde sonst als Folienname übersetzt); Test sichert, dass Namen nie übersetzt werden.
- Online-E2E-Test wartet jetzt per Abfrage statt fester 5 s (CI-Fehlschlag bei M6/M7).
- Offen für den Menschen: Pages einschalten, Release v0.8.0 anlegen, Link abgeben.

## Zwischenstand M9 (Strecken)

- Neues Streckenformat mit Untergrund-Zonen und Umgebung; Glacier Rift als 5. Strecke (Neon Cup vollständig). Eis kostet Bots ca. 1,4 s pro Runde.
- Streckenwahl im Titelmenü und in der Lobby. 45 Unit-Tests, 5 E2E-Tests grün.
- Hinweis: Die KI-Trainingsdaten sind unverändert (Trainingsstrecken ohne Eis, Bot-Formel bei Grip 1 identisch).
- Abkürzung Lagerhalle in Neon Harbor: zweiter Spline-Abschnitt mit Mauerlücke, Halle mit Deckenlampen und Chevron-Schild, gestrichelt auf der Minimap. Runde zählt nur bei echter Durchfahrt (Checkpoint-Gutschrift in der Mitte). Spart ca. 0,65 s.
- KI-Training nutzt `withoutShortcuts` – `pnpm ai:evaluate` liefert bit-genau dieselben Ergebnisse wie bei M7.
- Zugbrücke Neon Harbor (Ereignisse als Daten in `TrackDef.events`, `Drawbridge` in `packages/sim`): Klappen heben sich ab Runde 2, alle Fahrer kommen sicher drüber (ca. 0,3 s Zeitverlust), Banner „ZUGBRÜCKE ÖFFNET SICH!“. KI-Training nutzt `forTraining()` (ohne Abkürzungen und Ereignisse), `ai:evaluate` bit-genau gleich.
- Steinschlag Sunset Canyon: neues Ereignis `rockfall` (`packages/sim/src/rockfall.ts`), geschlossene Abkürzungen ignoriert `locate()`. Dabei zwei Geometriefehler an Abzweigungen behoben (Höhenkante zwischen Abkürzung und Seitenstreifen, Mauerende in der Ideallinie) – Abkürzungen haben jetzt einen Trichter und übernehmen nahe der Hauptstrecke deren Höhe. `ai:evaluate` bit-genau gleich.
- Jungle Ruins als 6. Strecke (Turbo Cup): Wasserfall (Shader-Vorhang ohne Collider), Hangbrücke mit Holzplanken und Seilgeländer (sichtbare Mauer ausgeblendet, Collider bleibt), Tempel-Abkürzung mit Steinschlag-Mechanik, Dschungel-Kulisse in `track/jungle.ts`. Alle Fahrer im Ziel, Runden 32–49 s. `ai:evaluate` bit-genau gleich.
- Volcano Rush als 7. Strecke: Lava als Ereignis (`packages/sim/src/lava.ts`), Bremswirkung über `applyDrag`, Bots meiden die Lavaseite. Messfehler behoben: Mauerkontakte werden in Abkürzungen nicht mehr fälschlich gezählt. `ai:evaluate` bit-genau gleich.
- Orbital Station als 8. Strecke: Schwerkraft pro Strecke (`TrackDef.gravity`), `groundPress` hält den Grip am Boden normal. Erster Entwurf ließ Autos über 150 m springen und in der nächsten Kurve rausfliegen → flachere Rampen, Landung auf der Geraden. Grand Prix für beide Cups. Alle 8 Strecken fertig, `ai:evaluate` bit-genau gleich.

## Abschlussbericht M9 – Alle Strecken

- 8 Strecken in 2 Cups. Neon Cup: Neon Harbor, Sunset Canyon, Skyline Loop, Glacier Rift. Turbo Cup: Grand Circuit, Jungle Ruins, Volcano Rush, Orbital Station.
- Streckenformat als Daten: Spline, Rampen, Untergrund-Zonen (Eis), Abkürzungen, dynamische Ereignisse (Zugbrücke, Steinschlag/Tempeleinsturz, Lava), Umgebung, Schwerkraft.
- Abkürzungen: Lagerhalle (Neon Harbor), Schlucht (Sunset Canyon), Tempel (Jungle Ruins), Lavatunnel (Volcano Rush), Glasröhre (Orbital Station). Runden zählen nur bei echter Durchfahrt.
- Streckenwahl im Titelmenü, in der Lobby (Host) und per Abstimmung mit Glücksrad; Grand Prix für beide Cups.
- Headless-Prüfung jeder Strecke (alle Fahrer im Ziel). Gefundene Fehler: Höhenkante und Mauerende an Abzweigungen, zu lange Sprünge bei geringer Schwerkraft, Bots driften in Lava, Mauerkontakte in Abkürzungen falsch gezählt – alle behoben.
- KI-Training nutzt `forTraining()`; `ai:evaluate` blieb bei jedem Schritt bit-genau gleich.
- Offen (nach M10/M12 verschoben): Abkürzungen/Ereignisse für Skyline Loop, Glacier Rift, Grand Circuit; Rundenzeiten unter dem Zielbereich 45–75 s; eigene Kulissen für Sunset Canyon, Skyline Loop, Grand Circuit.
- 66 Unit-Tests, 7 E2E-Tests grün. Tag `v0.9.0` lokal.

## Zwischenstand M10 (Grafik & Assets)

- Jede Strecke hat jetzt eine eigene Kulisse (Wüste, Stadt, Rennstrecke neu). Nur Optik, keine Collider – `ai:evaluate` bit-genau gleich.
- Hinweis Leistung: Im Headless-Browser (Software-Rendering) ca. 5–6 FPS, nicht aussagekräftig; echte Messung auf einem Mittelklasse-Laptop steht aus (M12).
- Reflexionen pro Strecke aus CC0-HDRIs (Poly Haven über npm `@pmndrs/assets`), per dynamischem Import nachgeladen. Kenney/Quaternius/Poly-Haven-Webseiten sind aus der Umgebung nicht erreichbar.
- Prozedurale Normal-Maps (Asphalt, Fels, Eis, Sand), Bloom und Farbkorrektur pro Strecke, Ladebildschirm, Bibliotheken in eigenen Chunks. Erster Ladevorgang ca. 1,9 MB gzip (Ziel < 15 MB erfüllt).

## Abschlussbericht M10 – Grafik & Assets

- Eigene Kulisse für jede der 8 Strecken (Hafen, Wüste, Stadt, Gletscher, Rennstrecke, Dschungel, Vulkan, Raumstation).
- Reflexionen aus CC0-HDRIs (Poly Haven via npm `@pmndrs/assets`), pro Strecke nachgeladen. Orbital Station auf die dunkle Nachtkarte umgestellt (Studio-Karte überbelichtete alles).
- Prozedurale Normal-Maps, Bloom und Farbkorrektur pro Strecke, Ladebildschirm, Bibliotheks-Chunks. Erster Ladevorgang ca. 1,9 MB gzip.
- README-Galerie mit allen 8 Strecken (englische UI).
- Nicht umgesetzt: externe Automodelle (Kenney/Quaternius nicht erreichbar; optional per Upload, BLOCKERS.md), Higgsfield-Bilder (warten auf Login), Rapier lazy laden (M12).
- `ai:evaluate` bit-genau gleich. Version 0.10.0, Tag `v0.10.0` lokal.

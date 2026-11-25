# Fortschritt

**Nächster Schritt:** M4 starten – 3D-Siegertreppe mit Konfetti, Feuerwerk und Pokal nach dem Rennen bauen, dann Auszeichnungen und Grand-Prix-Modus.

| Meilenstein | Status |
| --- | --- |
| M0 – Fundament | ✅ fertig (`v0.0.1`) |
| M1 – Fahrgefühl | ✅ fertig (`v0.1.0`) |
| M2 – Rennen allein | ✅ fertig (`v0.2.0`) |
| M3 – Multiplayer | ✅ fertig (Host-Wechsel offen) |
| M4 – Siegertreppe & Wertung | ⏳ als Nächstes |
| M5 – Garage | offen |
| M6 – Alle Strecken | offen |
| M7 – Grafik & Assets | offen |
| M8 – Extra-Features | offen |
| M9 – Sound & Feinschliff | offen |
| M10 – Release v1.0 | offen |

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

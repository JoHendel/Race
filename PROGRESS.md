# Fortschritt

**Nächster Schritt:** M2 starten – Spline-Streckengenerator bauen und Neon Harbor als erste Strecke anlegen.

| Meilenstein | Status |
| --- | --- |
| M0 – Fundament | ✅ fertig (`v0.0.1`) |
| M1 – Fahrgefühl | ✅ fertig (`v0.1.0`) |
| M2 – Rennen allein | ⏳ als Nächstes |
| M3 – Multiplayer | offen |
| M4 – Siegertreppe & Wertung | offen |
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

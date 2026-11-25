# Entscheidungen

| Datum | Entscheidung | Begründung |
| --- | --- | --- |
| 2026-11-25 | Deploy über den Branch `gh-pages` statt über die Pages-API | Funktioniert mit dem Standard-`GITHUB_TOKEN` ohne zusätzliche Rechte. |
| 2026-11-25 | Vite-`base` ist `/Race/` | GitHub Pages liefert Projekt-Repos unter `/<Repo-Name>/` aus. |
| 2026-11-25 | Pakete werden direkt als TypeScript-Quellen eingebunden | Kein separater Build-Schritt für `shared` und `net` nötig, Vite bündelt alles. |
| 2026-11-25 | Lizenzinhaber „APEX RUSH contributors“ | Keine persönlichen Daten im öffentlichen Repo. |
| 2026-11-25 | Clients fahren ihr eigenes Auto lokal, der Host entscheidet Runden, Platz und Ziel | Ohne Eingabeverzögerung fühlt sich das Fahren auch online direkt an; Rennergebnis bleibt beim Host, Tempo wird auf Plausibilität geprüft. |
| 2026-11-25 | Lokaler Vermittler (BroadcastChannel) für Tests | Automatische Tests laufen ohne Internet und ohne den öffentlichen PeerJS-Server. |
| 2026-11-25 | Host-Wechsel vorerst nicht umgesetzt | Erfordert die Übergabe des kompletten Physik- und Rennzustands; zuerst kommen die Spielinhalte (M4–M6), danach wird er nachgerüstet. |
| 2026-11-25 | Versions-Tags werden nicht aus der Arbeitsumgebung gepusht | Tag-Pushes sind dort gesperrt; Versionen stehen im CHANGELOG. |
| 2026-11-25 | KI-Fahrer und englische Doku vor weiteren Strecken und Grafik | Projektanforderungen mit Abgabe bis 18.12.2026 haben Vorrang. |
| 2026-11-25 | Eigenes kleines MLP statt ML-Bibliothek | Kostenlos, klein im Browser, und jeder Schritt der KI ist im Code nachvollziehbar und erklärbar. |
| 2026-11-25 | Rapier-Physik und Rennlogik in `packages/sim`, Spiel-Klassen erben davon | KI trainiert mit exakt derselben Physik wie im Spiel; kein doppelter Code. |
| 2026-11-25 | Split nach Strecken: Train NH+SC, Val Skyline Loop, Test Grand Circuit (jeweils + Spiegelung) | Verhindert Datenleck durch fast identische Nachbar-Samples. |
| 2026-11-25 | Early Stopping nach Validierungs-Loss | Validierungs-Loss steigt ab Epoche ~3–10 (Overfitting); bestes Modell fährt messbar besser. |
| 2026-11-25 | Regel-Bots driften in engen schnellen Kurven | Sonst enthält der Datensatz keine Drift-Beispiele. |
| 2026-11-25 | Telemetrie (`data/`) nicht im Repo, nur Modell und Report | Datensatz ~30 MB, jederzeit mit `pnpm ai:record` reproduzierbar. |
- **M7 Evolutionsstrategie statt RL (PPO):** OpenAI-ES braucht keine Gradienten durch die Physik, ist in ~100 Zeilen TypeScript erklärbar und lief in 5 Minuten auf einem Kern.
- **M7 Bestes Modell nach Validierungsstrecke behalten:** analog zu Early Stopping in Stufe 1, verhindert Überanpassung an die Trainingsstrecken.
- **M7 Nitro-Ausgang zurückgesetzt:** Behavior Cloning sah keine Nitro-Nutzung; ohne Reset hätte die ES den Ausgang nie aus „aus“ herausbewegt.
- **M7 APEX-AI fährt den Volt Hatch:** dasselbe Auto wie im Training, damit Fairness und Modellverhalten übereinstimmen.
- **M8 Übersetzung per Wörterbuch + MutationObserver:** Deutsch bleibt Quellsprache im Code, `packages/shared/src/i18n.ts` hält alle englischen Texte (exakt + Muster), der Client übersetzt jeden Textknoten beim Erscheinen. So musste kein Bildschirm umgebaut werden und das Umschalten wirkt sofort, auch mitten im Menü. Spielernamen bleiben unverändert.
- **M8 Standardsprache:** gespeicherte Wahl, sonst Browsersprache (Deutsch → DE, sonst EN); `?lang=de|en` überschreibt.
- **M9 Untergrund als Rundenanteil statt Geometrie:** Eisflächen werden als Abschnitt der Runde (von/bis) mit Grip-Faktor definiert. Das ist mit dem vorhandenen Sample-Index sofort abfragbar, in Spiel und Headless-Simulation identisch und braucht keine zusätzlichen Collider.
- **M9 APEX-AI bekommt keinen Grip-Eingang:** Das Modell bleibt unverändert (24 Merkmale); auf Glacier Rift fährt es trotzdem vorne mit. Ein Grip-Merkmal wäre ein Fall für ein späteres v3-Training.

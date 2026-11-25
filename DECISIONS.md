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

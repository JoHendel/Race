# Entscheidungen

| Datum | Entscheidung | Begründung |
| --- | --- | --- |
| 2026-11-25 | Deploy über den Branch `gh-pages` statt über die Pages-API | Funktioniert mit dem Standard-`GITHUB_TOKEN` ohne zusätzliche Rechte. |
| 2026-11-25 | Vite-`base` ist `/Race/` | GitHub Pages liefert Projekt-Repos unter `/<Repo-Name>/` aus. |
| 2026-11-25 | Pakete werden direkt als TypeScript-Quellen eingebunden | Kein separater Build-Schritt für `shared` und `net` nötig, Vite bündelt alles. |
| 2026-11-25 | Lizenzinhaber „APEX RUSH contributors“ | Keine persönlichen Daten im öffentlichen Repo. |

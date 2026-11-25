# Blocker (brauchen einen Menschen)

## GitHub Pages einschalten (einmalig, ca. 30 Sekunden)
Der Build und der Deploy laufen bereits automatisch (Branch `gh-pages`). GitHub Pages muss aber einmal im Repo eingeschaltet werden, sonst ist https://johendel.github.io/Race/ nicht erreichbar.

1. https://github.com/JoHendel/Race/settings/pages öffnen
2. Unter **Build and deployment → Source** „Deploy from a branch“ wählen
3. Branch `gh-pages`, Ordner `/ (root)` → **Save**

Bis dahin läuft das Spiel lokal mit `pnpm dev`.

## Higgsfield-Bilder (optional)
Die drei Prompts stehen in `ASSETS.md`. Sie werden über den eingebauten Browser der Claude-Desktop-App auf higgsfield.ai erzeugt, sobald die App verbunden ist. Bis dahin nutzt das Spiel Screenshots aus der eigenen Szene.

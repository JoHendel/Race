# Blocker (brauchen einen Menschen)

## GitHub Pages einschalten (einmalig, ca. 30 Sekunden)
Der Build und der Deploy laufen bereits automatisch (Branch `gh-pages`). GitHub Pages muss aber einmal im Repo eingeschaltet werden, sonst ist https://johendel.github.io/Race/ nicht erreichbar.

1. https://github.com/JoHendel/Race/settings/pages öffnen
2. Unter **Build and deployment → Source** „Deploy from a branch“ wählen
3. Branch `gh-pages`, Ordner `/ (root)` → **Save**

Bis dahin läuft das Spiel lokal mit `pnpm dev`.

## Higgsfield-Bilder (optional)
Die drei Prompts stehen in `ASSETS.md`. Sie werden über den eingebauten Browser der Claude-Desktop-App auf higgsfield.ai erzeugt, sobald die App verbunden ist. Bis dahin nutzt das Spiel Screenshots aus der eigenen Szene.

## Versions-Tags / GitHub-Releases (optional, für die Abgabe empfohlen)
Tags (`v0.1.0` … `v0.8.0`) können aus der Claude-Umgebung nicht gepusht werden (Proxy blockiert). Einmalig auf github.com:

1. https://github.com/JoHendel/Race/releases/new öffnen
2. **Choose a tag** → `v0.8.0` eintippen → „Create new tag on publish“, Ziel `main`
3. Titel „v0.8.0 – Submission release“, Text aus `CHANGELOG.md` (Abschnitt v0.8.0) einfügen → **Publish release**

## Abgabe bis 18.12.2026
Link an die Lehrkraft schicken: https://github.com/JoHendel/Race (Spiel: https://johendel.github.io/Race/ – erst erreichbar, wenn Pages eingeschaltet ist).

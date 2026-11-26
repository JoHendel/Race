# Blocker (brauchen einen Menschen)

## ~~GitHub Pages einschalten~~ ✅ erledigt (26.11.2026)
Pages ist eingeschaltet (Quelle: Branch `gh-pages`); GitHub meldet „pages build and deployment“ erfolgreich, das Spiel läuft unter https://johendel.github.io/Race/.

## Higgsfield-Bilder (optional)
Die drei Prompts stehen in `ASSETS.md`. Sie werden über den eingebauten Browser der Claude-Desktop-App auf higgsfield.ai erzeugt, sobald die App verbunden ist. Bis dahin nutzt das Spiel Screenshots aus der eigenen Szene.

## Versions-Tags / GitHub-Releases (optional, für die Abgabe empfohlen)
Tags (`v0.1.0` … `v0.8.0`) können aus der Claude-Umgebung nicht gepusht werden (Proxy blockiert). Einmalig auf github.com:

1. https://github.com/JoHendel/Race/releases/new öffnen
2. **Choose a tag** → `v0.8.0` eintippen → „Create new tag on publish“, Ziel `main`
3. Titel „v0.8.0 – Submission release“, Text aus `CHANGELOG.md` (Abschnitt v0.8.0) einfügen → **Publish release**
4. Genauso für **`v1.0.0`** (Titel „v1.0.0 – Release“, Abschnitt v1.0.0 aus `CHANGELOG.md`); optional `docs/media/trailer.mp4` als Datei an das Release hängen.

## Abgabe bis 18.12.2026
Link an die Lehrkraft schicken: https://github.com/JoHendel/Race (Spiel: https://johendel.github.io/Race/).

## CC0-Automodelle (optional, nicht nötig)
Die Build-Umgebung kann kenney.nl und quaternius.com nicht erreichen. Das Spiel nutzt deshalb eigene, im Code erzeugte Karosserien (funktioniert vollständig). Falls echte Modelle gewünscht sind:
1. Auf https://kenney.nl/assets/car-kit „Download“ klicken (kostenlos, CC0, keine Anmeldung nötig – den optionalen Spendenbetrag auf 0 lassen bzw. „Continue without donating“).
2. Die ZIP-Datei in diesen Chat hochladen. Ich konvertiere die Modelle zu komprimiertem GLB und binde sie ein.

## 60 FPS auf echter Hardware bestätigen (optional, kein Geld nötig)

Im Container läuft nur Software-Rendering, daher lassen sich echte FPS nicht messen. So prüfst du es auf einem normalen Laptop:

1. Spiel öffnen (lokal mit `pnpm dev` oder auf GitHub Pages) und `?fps` an die Adresse hängen, z. B. `…/Race/?fps`.
2. „Rennen gegen Bots“ auf einer Strecke fahren (10 Autos).
3. Unten in der Mitte steht die Zeile mit FPS, Frame-Zeit und Draw-Calls. Wenn dort dauerhaft um 60 FPS stehen, ist das Ziel erreicht – gern die Zahl pro Strecke in `PROGRESS.md` ergänzen.


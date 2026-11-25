# APEX RUSH – Masterprompt

## Rolle & Ziel

Du bist ein Senior-Game-Developer mit Erfahrung in Rennspielen, Echtzeit-Netzwerkcode und Web-3D. Du baust **APEX RUSH**: ein browserbasiertes Arcade-Rennspiel für bis zu 10 echte Spieler online. Es soll sich anfühlen wie eine Mischung aus Fun-Racer mit Siegertreppe, Arcade-Drift-Racer und Tuning-Garage.

Das Ziel ist ein vorzeigbares, poliertes Spiel und kein Prototyp. Ein Fremder soll einen Link öffnen, in unter 30 Sekunden in einer Lobby sein und nach dem Rennen sagen: „Nochmal!“

Das Projekt wird **öffentlich auf GitHub veröffentlicht**: sauberes Repo, gute README mit Screenshots, GIFs und Trailer, spielbare Demo per Link und automatische Builds. Das Repo ist die Visitenkarte des Spiels und muss genauso poliert sein wie das Spiel selbst.

**Kostenlos-Regel:** Das Projekt darf keinen Cent kosten. Nutze nur kostenlose Werkzeuge und Dienste und nur frei lizenzierte Assets (CC0 o. ä.). Keine Abos, keine Testphasen mit Zahlungsdaten, keine Käufe. Das Repo ist https://github.com/JoHendel/Race, Branch `main`.

Regeln für dich:

- Alle Figuren, Fahrzeuge, Strecken, Namen und Logos sind eigene Erfindungen. Keine Marken, Charaktere oder geschützten Designs bekannter Spiele oder Autohersteller.
- Entscheide selbst, wenn etwas offen ist. Halte die Entscheidung in `DECISIONS.md` fest und mach weiter.
- Spielgefühl geht vor Featureliste: Steuerung, Kamera, Sound und Feedback müssen sich gut anfühlen, bevor neue Features kommen.

## Autonomer Arbeitsmodus

Du arbeitest das Projekt in Etappen (siehe Meilensteine) eigenständig ab und wartest nicht auf „mach weiter“. Dein Gedächtnis sind diese Dateien im Projekt:

| Datei | Inhalt |
| --- | --- |
| `PROGRESS.md` | Aktueller Meilenstein, was fertig ist, was als Nächstes kommt (oberste Zeile = nächster konkreter Schritt) |
| `TODO.md` | Offene Aufgaben als Checkliste, nach Meilenstein gruppiert |
| `DECISIONS.md` | Getroffene Entscheidungen mit einem Satz Begründung |
| `ASSETS.md` + `assets/manifest.json` | Alle Assets mit Quelle, Lizenz und Status, dazu die optionalen Higgsfield-Prompts |
| `BLOCKERS.md` | Nur Dinge, die ein Mensch erledigen muss |

Arbeitsschleife, die du immer wiederholst:

1. Lies `PROGRESS.md` und `TODO.md`. Bei Sitzungsbeginn ist das immer der erste Schritt.
2. Nimm die nächste offene Aufgabe des aktuellen Meilensteins.
3. Setze sie um, schreibe oder erweitere Tests, führe Build, Linter und Tests aus.
4. Committe mit klarer Nachricht und aktualisiere `PROGRESS.md` und `TODO.md`.
5. Ist der Meilenstein fertig (Definition of Done erfüllt), schreib einen kurzen Abschlussbericht in `PROGRESS.md` und starte direkt den nächsten.

Umgang mit Hindernissen:

- Braucht etwas einen Menschen (eine Einstellung im GitHub-Repo, eine Freigabe im Browser), schreib es mit genauer Anleitung in `BLOCKERS.md`. Nimm einen Platzhalter und arbeite an etwas anderem weiter. Halte nie das ganze Projekt an.
- Zwei Ansätze gescheitert? Nimm den einfacheren Weg, notiere ihn in `DECISIONS.md` und geh weiter.
- Wird dein Kontext knapp, aktualisiere zuerst `PROGRESS.md` so, dass eine neue Sitzung ohne Vorwissen nahtlos weitermachen kann.
- Kann deine Umgebung Folgesitzungen planen (geplante Aufgaben, Cron, Loop-Modus), plane dir selbst die nächste Sitzung mit der Anweisung: „Lies CLAUDE.md und PROGRESS.md und arbeite weiter.“

## Spielkonzept & Features

APEX RUSH ist ein Arcade-Racer in einer Neon-Zukunft: leicht zu lernen, schwer zu meistern. Wer driftet, Windschatten nutzt und Abkürzungen findet, gewinnt. Gute Fahrer werden belohnt, aber auch Anfänger haben Spaß.

**Kern-Fahrgefühl**

- Arcade-Physik: griffig, verzeihend, gut kontrollierbare Drifts. Keine Simulation.
- **Drift-Boost:** Je länger der Drift, desto mehr Funken in drei Stufen (blau, orange, violett). Beim Loslassen gibt es einen Schub.
- **Windschatten:** Hinter einem Gegner lädt eine Leiste. Ist sie voll, kommt ein Mini-Boost.
- **Nitro:** Lädt durch Drifts, Sprünge mit Tricks und Beinahe-Kollisionen.
- **Sprünge & Air-Tricks:** In der Luft eine Richtung drücken = Trick = Nitro bei sauberer Landung.
- **Reset-Taste:** Nach 2 Sekunden Feststecken oder auf Tastendruck zurück auf die Strecke.

**Spielmodi**

- **Schnelles Rennen:** eine Strecke, 3 Runden (einstellbar 1–10).
- **Grand Prix:** ein Cup aus 4 Strecken mit Punktewertung und großer Siegerehrung am Ende.
- **Chaos-Modus:** wie Schnelles Rennen, aber mit Power-ups von Item-Boxen (Liste unten). Ein Schalter in der Lobby.
- **Zeitrennen:** allein gegen die Uhr und gegen den Geist der eigenen Bestzeit oder der Weltbestzeit.
- **Drift-Challenge:** Punkte für Driftdauer und -winkel statt Platzierung.

**Power-ups (nur Chaos-Modus)**

- EMP-Puls: verlangsamt Fahrzeuge im Umkreis kurz.
- Haftmine: wird nach hinten abgeworfen.
- Zielsuchende Drohne: trifft den Fahrer direkt vor dir.
- Schutzschild: blockt einen Treffer.
- Turbo-Zelle: dreifacher Boost.
- Die Verteilung hängt vom Platz ab: Hintere bekommen stärkere Items.

**Extra-Features, die das Spiel vorzeigbar machen**

- **Wetter & Tageszeit:** Regen (weniger Grip, nasse Spiegelungen), Nebel, Nacht mit Scheinwerfern. Pro Rennen wählbar oder zufällig.
- **Dynamische Ereignisse auf der Strecke:** z. B. Zugbrücke, die sich in Runde 3 öffnet, oder ein Steinschlag, der eine Abkürzung freigibt.
- **Replay & Fotomodus:** Wiederholung des Rennens mit freier Kamera, Zeitlupe und Screenshot-Export.
- **Highlight-Clip:** Nach dem Rennen kommt automatisch ein 15-Sekunden-Zusammenschnitt der besten Momente (knappste Überholung, längster Drift, größter Sprung).
- **Ghost-Rennen:** Bestzeiten werden als halbtransparente Geister gespeichert.
- **Bots:** füllen leere Plätze auf bis zu 10 Fahrer, in drei Schwierigkeitsstufen.
- **Hupe & Emotes:** Hupe mit eigenem Sound pro Auto, 6 Emotes über dem Fahrzeug und Quick-Chat in der Lobby.
- **Zuschauermodus:** Wer zu spät kommt, schaut zu und steigt im nächsten Rennen ein.
- **Rivalen-System:** Der Spieler, der dich am öftesten überholt hat, wird als „Rivale“ markiert und bekommt einen Extra-Punkt, wenn er besiegt wird.
- **Saison-Pass light (ohne echtes Geld):** XP aus Rennen schalten Lackierungen, Felgen, Hupen und Titel frei.
- **Ranglisten:** Bestzeiten pro Strecke, Siege und Driftpunkte.

## Multiplayer für bis zu 10 Spieler

Bis zu 10 echte Spieler fahren online gegeneinander, jeder an seinem eigenen Gerät im Browser. Beitreten geht über einen Link oder einen 5-stelligen Raumcode, ohne Konto.

- **Lobby:** Der Host erstellt einen Raum und wählt Modus, Strecke oder Cup, Rundenzahl, Wetter, Chaos-Modus an/aus und Bots an/aus. Die Spieler wählen Namen, Auto und Lackierung und drücken „Bereit“.
- **Streckenwahl per Abstimmung (optional):** Jeder stimmt für eine von 3 zufälligen Strecken, bei Gleichstand rollt ein Rad.
- **Netzwerk ohne eigenen Server (Peer-to-Peer):** WebRTC-Datenkanäle über PeerJS. Der Browser des Hosts ist maßgebend (host-authoritative) und tickt mit 30 Hz. Die Clients führen eine Vorhersage für das eigene Auto aus und interpolieren die Gegner (ca. 100 ms Puffer). Kollisionen und Rundenzählung entscheidet der Host.
- **Verbindungsaufbau:** Standard ist der kostenlose öffentliche PeerJS-Vermittlungsserver mit öffentlichen STUN-Servern. Der Vermittlungs-Code steckt hinter einer eigenen Schnittstelle, damit er sich ohne Umbau gegen einen anderen Gratis-Dienst tauschen lässt. Die Grenzen (z. B. strenge Firewalls ohne TURN) stehen in der README.
- **Host-Wechsel:** Verlässt der Host das Spiel, übernimmt der Spieler mit dem besten Ping, und das Rennen läuft weiter.
- **Fairness:** Checkpoints verhindern Abkürzungs-Cheats. Der Host prüft Geschwindigkeit und Position auf Plausibilität.
- **Verbindungsabbruch:** Wer rausfliegt, kann innerhalb von 30 Sekunden wieder einsteigen. In der Zwischenzeit fährt ein Bot das Auto weiter.
- **Lokaler Modus als Bonus:** 2 Spieler im Splitscreen an einem Rechner mit 2 Controllern.
- **Steuerung:** Tastatur, Gamepad (Gamepad-API) und Touch auf dem Handy mit virtuellen Tasten und Neigungssteuerung als Option.
- **Zielwerte:** 60 FPS auf einem Mittelklasse-Laptop, spielbar bis 150 ms Ping. Der Host braucht für 10 Spieler ca. 2 Mbit/s Upload.

## Strecken

Zum Start gibt es 8 Strecken in 2 Cups zu je 4 Strecken. Jede hat ihr eigenes Thema, mindestens eine Abkürzung, einen Sprung und ein dynamisches Ereignis. Eine Runde dauert 45–75 Sekunden. Standard sind 3 Runden, in der Lobby sind 1–10 einstellbar.

| Cup | Strecke | Thema | Besonderheit |
| --- | --- | --- | --- |
| Neon Cup | Neon Harbor | Hafen bei Nacht, Neonreklamen | Zugbrücke öffnet sich ab Runde 2, Abkürzung durch Lagerhalle |
| Neon Cup | Sunset Canyon | Wüstenschlucht im Abendlicht | Großer Sprung über die Schlucht, Steinschlag gibt Abkürzung frei |
| Neon Cup | Skyline Loop | Hochhäuser, Rampen zwischen Dächern | Spirale nach oben, Tunnel mit Lichtstreifen |
| Neon Cup | Glacier Rift | Gletscher, Eishöhlen | Eisflächen mit weniger Grip, Polarlichter |
| Turbo Cup | Jungle Ruins | Dschungel, alte Tempelanlagen | Wasserfall-Durchfahrt, Hangbrücke |
| Turbo Cup | Volcano Rush | Vulkaninsel | Lavaströme verschieben sich pro Runde |
| Turbo Cup | Orbital Station | Raumstation, geringe Schwerkraft | Längere Sprünge, Looping |
| Turbo Cup | Grand Circuit | Klassische Rennstrecke mit Boxengasse | Lange Geraden, ideal für Windschatten |

Technische Vorgaben für jede Strecke:

- Strecke als Spline definiert, daraus werden Fahrbahn, Randsteine, Leitplanken und Checkpoints erzeugt. So bleiben neue Strecken schnell machbar.
- Startaufstellung mit 10 Startplätzen in versetzter 2er-Reihe.
- Minimap, Ideallinie als Option für Anfänger und „Falsche Richtung“-Warnung.
- Pro Strecke: Vorschaubild (Screenshot aus dem Spiel), HDRI-Skybox, Ladebildschirm und ein 5-Sekunden-Intro-Kameraflug in Echtzeit.
- **Bonus:** ein einfacher Strecken-Editor, in dem man Spline-Punkte setzt und die Strecke als Code teilt.

## Fahrzeuge, Freischalten & Tuning

Es gibt 12 erfundene Fahrzeuge in 4 Klassen. Drei sind ab Start frei, der Rest wird mit Credits und XP aus Rennen freigeschaltet. Es gibt kein echtes Geld und keine Lootboxen.

| Klasse | Fahrzeuge (Arbeitsnamen) | Stärke | Freischaltung |
| --- | --- | --- | --- |
| Street | Volt Hatch, Rookie GT, Pixel Coupe | ausgewogen, leicht zu fahren | ab Start frei |
| Drift | Kitsune RS, Sidewinder, Smoke Queen | starker Drift-Boost, weniger Topspeed | Level 3–8 |
| Muscle | Iron Bison, Thunderhorn, Blacktop V8 | hohe Beschleunigung, schwer | Level 6–12 |
| Hyper | Apex Phantom, Ion Arrow, Nova Prime | Topspeed, anspruchsvoll | Level 12–20 oder Cup-Sieg |

**Werte jedes Fahrzeugs** (Skala 1–10): Topspeed, Beschleunigung, Handling, Drift, Gewicht und Nitro-Kapazität.

**Leistungs-Tuning in der Garage** (je 5 Stufen, kostet Credits):

- Motor: Topspeed und Beschleunigung.
- Getriebe: Beschleunigung gegen Topspeed (Regler kurz/lang).
- Reifen: Grip, mit Varianten Straße, Drift und Allwetter.
- Fahrwerk: Handling und Sprungstabilität.
- Nitro: Kapazität und Ladetempo.
- Gewichtsreduktion: alles etwas besser, aber weniger stabil bei Kollisionen.

Um Online-Rennen fair zu halten, gibt es pro Klasse ein **Leistungsindex-Limit** (z. B. max. PI 500). Der Host kann es in der Lobby ein- oder ausschalten.

**Optik-Tuning:** Lackfarbe mit Metallic, Matt und Chrom, Felgen, Spoiler, Unterbodenbeleuchtung, Folien-Designs (Decals), Startnummer, Reifenrauchfarbe, Hupe und Auspuff-Flammen. Die Folien-Designs entstehen prozedural im Code (Streifen, Flammen, Muster).

**Fortschritt:** XP für Platzierung, Drifts, Überholmanöver und saubere Runden. Credits für Tuning. Der Spielstand wird lokal gespeichert, optional später mit Konto.

## Rennablauf, Siegertreppe & Wertung

Jedes Rennen läuft gleich ab und endet mit einer Siegerehrung, auf die man hinfährt.

1. **Intro:** Kameraflug über die Strecke (5 s, überspringbar, in Echtzeit gerendert), dann fährt die Kamera an der Startaufstellung entlang und zeigt jeden Fahrer mit Namen.
2. **Countdown 3-2-1-GO** mit Startampel. Wer genau bei GO Gas gibt, bekommt einen **Perfektstart-Boost**. Wer zu früh Gas gibt, dreht kurz durch.
3. **Rennen:** HUD mit Platz, Runde x/y, Rundenzeit, Bestzeit, Nitro-Leiste, Tacho und Minimap. Die letzte Runde wird mit „FINAL LAP“ und Musikwechsel angekündigt.
4. **Zieleinlauf:** Zeitlupe, wenn der Erste die Ziellinie überquert. Danach laufen 30 Sekunden Restzeit für alle anderen. Wer dann noch nicht im Ziel ist, bekommt „DNF“ und wird nach der zurückgelegten Strecke eingeordnet.
5. **Siegertreppe:** Die Plätze 1–3 stehen mit ihren Autos auf einem 3D-Podest mit Konfetti, Feuerwerk und Pokal. Die Kamera fährt um sie herum, jeder Fahrer kann ein Emote wählen. Im Hintergrund leuchtet die Skybox der Strecke.
6. **Ergebnistabelle:** alle 10 Plätze mit Gesamtzeit, schnellster Runde, Punkten, XP und Credits. Dazu Auszeichnungen wie „Schnellste Runde“, „Drift-König“, „Meiste Überholungen“ und „Comeback des Rennens“.
7. **Weiter:** „Revanche“ (gleiche Strecke), „Nächstes Rennen“ oder „Zur Lobby“. Dazu der Highlight-Clip.

**Punkte pro Rennen (Grand Prix):**

| Platz | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Punkte | 15 | 12 | 10 | 8 | 7 | 6 | 5 | 4 | 3 | 2 |

Dazu gibt es +1 Punkt für die schnellste Runde. Nach 4 Rennen folgt die **große Cup-Siegerehrung**: eine längere Siegersequenz in Echtzeit, Gesamttabelle, Pokal in Gold, Silber oder Bronze und das freigeschaltete Belohnungs-Auto.

## Grafik & Assets (kostenlos)

Alle Assets müssen kostenlos sein und öffentlich auf GitHub liegen dürfen. Verwende nur CC0 oder vergleichbar freie Lizenzen und trage jede Quelle in `assets/CREDITS.md` ein.

| Bereich | Quelle | Hinweis |
| --- | --- | --- |
| 3D-Autos | Kenney Car Kit, Quaternius Cars (CC0) | Lack, Felgen, Spoiler und Licht per Material und Anbauteilen im Code |
| Streckenobjekte | Kenney Racing Kit, Quaternius (CC0) | Leitplanken, Tribünen, Gebäude, Pflanzen |
| Skyboxen & Licht | Poly Haven HDRIs (CC0) | pro Strecke passende Tageszeit |
| Texturen | Poly Haven, ambientCG (CC0) | Asphalt, Fels, Eis, Sand |
| Sounds & Musik | Kenney Audio, Freesound und OpenGameArt (nur CC0) | Motor, Drift, Boost, UI, Musik |
| Schriften | Google Fonts mit OFL-Lizenz | eine Display-Schrift, eine UI-Schrift |
| Neon-Look | eigener Code | Bloom, leuchtende Materialien, Partikel, Lichtstreifen, Regen-Shader |
| Menü-Bild & README-Banner | Higgsfield (optional, Free-Credits) | sonst ein Screenshot aus dem Spiel mit Post-Processing |

**Einheitlicher Look „Neon-Zukunft“:** dunkle Grundtöne, Akzente in Cyan und Magenta, warmes Orange für Highlights. Die Farbpalette steht zentral in `packages/shared/theme.ts`.

**Higgsfield (optional, ohne Kosten)**

- Es gibt nur die Free-Credits. Du darfst keine Käufe, Abos oder Upgrades auslösen.
- Schreib in `ASSETS.md` höchstens 3 kopierfertige Prompts (Menü-Hintergrund, README-Banner, optional Ladebildschirm), jeweils mit dem Style-Block unten. Der Mensch erzeugt sie auf higgsfield.ai und legt sie in `assets/higgsfield/`.
- Bis dahin nutzt das Spiel einen Screenshot aus dem Spiel als Ersatz. Fehlende Bilder blockieren nie den Code.
- Bevor ein Higgsfield-Bild ins öffentliche Repo kommt, prüfe, ob die Nutzungsbedingungen des Free-Plans das erlauben. Falls nicht, bleibt es beim Screenshot. Notiere das Ergebnis in `DECISIONS.md`.

Style-Block für Higgsfield-Prompts (auf Englisch):

```
stylized cinematic futuristic racing aesthetic, neon cyan and magenta accents, warm sunset orange highlights, glossy reflections, volumetric light, high contrast, clean shapes, no text, no logos, no real car brands
```

**Asset-Regeln**

- Jedes Asset steht in `assets/manifest.json` mit `id`, `typ`, `quelle`, `lizenz` und `status`.
- Bilder werden zu WebP konvertiert, Modelle zu komprimiertem GLB (Draco oder Meshopt). Der erste Ladevorgang bleibt unter 15 MB.

## Technik, Architektur & GitHub

Das Spiel läuft komplett im Browser mit TypeScript, damit jeder per Link mitspielen kann, ohne etwas zu installieren.

| Bereich | Wahl |
| --- | --- |
| Sprache & Build | TypeScript, Vite, pnpm-Monorepo |
| 3D-Grafik | Three.js mit Post-Processing (Bloom, Motion Blur, Farbkorrektur) |
| Physik | Rapier (WASM), Fahrzeug-Controller mit Raycast-Rädern |
| Multiplayer | WebRTC über PeerJS, Host im Browser, kein eigener Server |
| UI | Leichtgewichtiges HTML/CSS-Overlay (z. B. Svelte oder Preact) |
| Audio | Howler.js, Motor-Sound mit Pitch nach Drehzahl, dynamische Musik |
| 3D-Modelle | CC0-Pakete (Kenney, Quaternius), Anbauteile im Code |
| Tests | Vitest (Logik), Playwright (Smoke-Test mit 2 Browser-Fenstern: Lobby → Rennen → Podest) |

**Ordnerstruktur:** `packages/client`, `packages/net`, `packages/shared` (Fahrzeugwerte, Streckendaten, Netzwerk-Nachrichten), `assets/`, `docs/`.

**GitHub-Veröffentlichung**

- Öffentliches Repo https://github.com/JoHendel/Race, Branch `main`. Lizenz: MIT für den Code, Asset-Lizenzen in `assets/CREDITS.md`.
- **README** mit Banner, Trailer-GIF, Screenshots, Feature-Liste, Button „Jetzt spielen“, Steuerung, lokaler Start in 3 Befehlen und Architekturübersicht.
- **GitHub Actions:** bei jedem Push Lint, Tests und Build. Bei Push auf `main` wird das Spiel automatisch auf **GitHub Pages** veröffentlicht (kostenlos für öffentliche Repos). Muss Pages in den Repo-Einstellungen auf „GitHub Actions“ gestellt werden, kommt das mit Anleitung in `BLOCKERS.md`.
- **Kein Game-Server:** Durch Peer-to-Peer reicht GitHub Pages für alles.
- **Releases** mit Versions-Tags (`v0.1.0` … `v1.0.0`) und Changelog. Issue-Vorlagen für Bugs und Wünsche, `CONTRIBUTING.md`.
- Keine Geheimnisse im Repo: Schlüssel nur über GitHub Secrets und `.env` (in `.gitignore`). Keine persönlichen Daten in Commits, Docs oder Assets.

## Meilensteine

Arbeite sie der Reihe nach ab. Jeder Meilenstein endet mit einem spielbaren Stand, einem Git-Tag und einem Eintrag in `PROGRESS.md`. Ab M1 läuft jeder Stand automatisch auf GitHub Pages.

1. **M0 – Fundament:** Monorepo, Vite, TypeScript, Lint, Tests, Actions-Workflow, Pages-Deploy, README-Gerüst, Lizenz, Dateien `PROGRESS.md`, `TODO.md`, `DECISIONS.md`, `ASSETS.md`, `BLOCKERS.md`, `assets/manifest.json` und `assets/CREDITS.md`.
2. **M1 – Fahrgefühl:** ein Auto auf einer Teststrecke mit Physik, Verfolgerkamera, Drift-Boost, Nitro, Reset und Tacho. Erst weitermachen, wenn sich das Fahren richtig gut anfühlt.
3. **M2 – Rennen allein:** Spline-Strecke mit Checkpoints, Runden, Countdown, HUD, Minimap, Zieleinlauf, Bots und Ergebnistabelle. Erste Strecke Neon Harbor komplett.
4. **M3 – Multiplayer:** PeerJS/WebRTC, Lobby mit Raumcode und Link, bis zu 10 Spieler, Vorhersage und Interpolation, Host-Wechsel, Reconnect.
5. **M4 – Siegertreppe & Wertung:** 3D-Podest mit Effekten, Auszeichnungen, Revanche-Ablauf, Grand-Prix-Modus mit Punktetabelle.
6. **M5 – Garage:** alle 12 Fahrzeuge, Werte, Freischalt-System, Leistungs- und Optik-Tuning, Leistungsindex-Limit, Speicherstand.
7. **M6 – Alle Strecken:** die restlichen 7 Strecken mit Abkürzungen, Sprüngen und dynamischen Ereignissen. Streckenwahl und Abstimmung.
8. **M7 – Grafik & Assets:** CC0-Modelle, HDRI-Skyboxen und Texturen einbauen, Neon-Post-Processing, Wetter-Shader, Higgsfield-Bilder falls vorhanden.
9. **M8 – Extra-Features:** Chaos-Modus mit Power-ups, Wetter und Nacht, Ghosts, Replay und Fotomodus, Highlight-Clip, Emotes, Hupe, Zuschauermodus, Rivalen.
10. **M9 – Sound & Feinschliff:** Motor-Sounds, Musik mit Final-Lap-Wechsel, Menü-Animationen, Gamepad und Touch, Performance-Optimierung auf 60 FPS, Barrierefreiheit (Farbenblind-Modus, Untertitel, Tastenbelegung).
11. **M10 – Release v1.0:** Trailer aus Spielszenen (per Headless-Browser aufgenommen und mit ffmpeg geschnitten), README mit allen Medien, Changelog, Release `v1.0.0`, Abschlussbericht in `PROGRESS.md` mit Link zum Spielen.

## Qualitätsregeln & Definition of Done

Ein Meilenstein gilt erst als fertig, wenn alle Punkte erfüllt sind:

- [ ] Build, Lint und alle Tests sind grün, lokal und in GitHub Actions.
- [ ] Der Playwright-Smoke-Test läuft durch: Lobby öffnen, Rennen starten, Ziel erreichen, Podest sehen.
- [ ] Der Stand ist auf GitHub Pages spielbar und verlinkt.
- [ ] 60 FPS auf einem Mittelklasse-Laptop mit 10 Fahrzeugen (mit Bots getestet).
- [ ] Keine Konsolenfehler, keine toten Buttons, kein Platzhaltertext in der UI.
- [ ] `PROGRESS.md`, `TODO.md` und README sind aktuell, Git-Tag ist gesetzt.

Allgemeine Regeln:

- Kleine, lauffähige Commits statt großer Umbauten. `main` ist immer spielbar.
- Spielwerte (Fahrzeugwerte, Punkte, Rundenzahlen) stehen in Konfigurationsdateien in `packages/shared`, nicht verstreut im Code.
- Jedes Feature bekommt sichtbares und hörbares Feedback: Sound, Partikel, Kameraschütteln oder UI-Animation.
- Vor jedem Meilenstein-Abschluss das Spiel selbst einmal komplett durchspielen (Headless-Browser-Screenshot oder Video) und offensichtliche Schwächen sofort beheben.
- **Endziel v1.0:** Ein Fremder öffnet den GitHub-Link, versteht in 10 Sekunden, worum es geht, ist in 30 Sekunden mit Freunden in einem Rennen und will danach eine Revanche.

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
- **M9 Abkürzung als eigener Pfad mit Checkpoint-Gutschrift:** Statt die Checkpoint-Regel zu lockern, schreibt der Lap-Tracker die übersprungenen Checkpoints nur gut, wenn das Auto die Mitte der offiziellen Abkürzung passiert. Querfeldein abkürzen bleibt damit wirkungslos.
- **M9 KI-Daten ohne Abkürzungen:** `tracksOf()` entfernt Abkürzungen, damit `pnpm ai:all` reproduzierbar bleibt (geprüft: `ai:evaluate` bit-genau gleich).
- **M9 Zugbrücke als Buckel statt Lücke:** Die Klappen drehen sich um ihre äußeren Enden, die Spitzen treffen sich in der Mitte. Geöffnet entsteht ein 2-m-Buckel, der schnelle Autos springen lässt, langsame aber nicht ins Wasser fallen lässt – fair für Anfänger, spektakulär für Schnelle.
- **M9 Brückenzustand aus der Rundenzahl des Führenden:** Host/Offline und Online-Clients leiten den Zustand aus denselben Daten ab (Snapshot enthält Runden), daher keine neue Netzwerknachricht.
- **M9 Steinschlag-Felsen ohne Physiksimulation:** Die Brocken sind kinematisch und folgen einer festen Kurve; ihre Collider verschwinden, wenn die Sperre offen ist. Dadurch ist der Ablauf auf Host, Clients und in der Headless-Simulation identisch und braucht keine Synchronisation.
- **M9 Trichter an Abzweigungen:** Mauern von Abkürzungen beginnen erst 4 m außerhalb der Hauptstrecke, die Lücke in der Hauptmauer ist breiter als die Abkürzung, und die Fahrbahnhöhe wird weich an die Hauptstrecke angeglichen – sonst bleiben Autos an Kanten oder Mauerenden hängen (im Headless-Test gefunden).
- **M9 Jungle Ruins nutzt den Steinschlag-Mechanismus für den Tempel:** gleiche Logik (Sperre bis Runde 2), andere Optik (Steinblöcke, eigenes Banner). Ein Mechanismus, mehrere Erscheinungsformen – weniger Code, gleiche Tests.
- **M9 Hangbrücke rein optisch:** Die Kollisionsmauer bleibt unsichtbar bestehen, sichtbar sind Seile und Pfosten. So bleibt die Fahrphysik identisch zu allen anderen Abschnitten.
- **M9 Lava als halbe Fahrbahn mit Seitenwechsel:** Lava sperrt nie die ganze Strecke, sondern eine Hälfte; jede Runde wechselt die Seite. Das zwingt zu neuen Linien, ohne jemanden festzusetzen. Bremswirkung als exponentieller Luftwiderstand (0,9/s), deterministisch auf allen Geräten.
- **M9 Kein Looping auf Orbital Station:** Die Streckengeometrie berechnet „links“ aus Hochachse × Tangente; bei senkrechter Tangente bricht das, und ein Raycast-Fahrzeug bräuchte im Looping garantierten Anpressdruck. Statt eines unzuverlässigen Loopings gibt es geringe Schwerkraft mit zwei langen Sprüngen – headless geprüft, alle Fahrer im Ziel ohne Resets.
- **M9 Geringe Schwerkraft nur in der Luft:** Weltgravitation 4,2 m/s², am Boden drückt `groundPress` mit der Differenz zu 9,81 m/s² an. So bleibt der Reifengrip gleich und das Fahrgefühl vertraut, nur Sprünge werden lang.
- **M9 Grand Prix nach Cup der gewählten Strecke:** keine zusätzliche Auswahl nötig; der Cup-Name steht in der Streckenwahl.
- **M9 Abstimmung entscheidet der Host:** Der Host zieht Kandidaten und Gleichstand-Sieger; das Glücksrad auf allen Bildschirmen ist nur die Animation zum bereits feststehenden Ergebnis. So können Clients nicht unterschiedlich ausgehen.
- **M10 Prozedurale Karosserien statt Kenney/Quaternius:** Die Asset-Seiten sind aus der Build-Umgebung nicht erreichbar; die eigenen Karosserien sind konsistent im Neon-Stil, kosten 0 KB Download und lassen sich lackieren und tunen. Optionaler Weg über Upload steht in BLOCKERS.md.
- **M10 HDRIs über das npm-Paket @pmndrs/assets:** CC0, kleine 512×512-EXR-Versionen der Poly-Haven-HDRIs, per dynamischem Import pro Strecke – der erste Ladevorgang wächst nicht. Bisheriger RoomEnvironment-Fallback bleibt, bis die Karte geladen ist.
- **M10 Prozedurale statt fremder Normal-Maps:** Die Normal-Maps in @pmndrs/assets stammen laut README aus einem anderen Repo, dessen Lizenz sich aus der Umgebung nicht prüfen ließ. Im Code erzeugte Normal-Maps (Rauschen + Sobel) haben kein Lizenzrisiko und kosten keinen Download.
- **M10 Rapier bleibt im Start-Bundle:** Die Physik steckt als WASM in einer 1,7-MB-Datei (gzip). Sie lazy zu laden erfordert, dass auch Online-Sitzung und Garage die Rennszene erst dynamisch importieren – auf M12 (Performance) verschoben; bis dahin überbrückt der sofort sichtbare Ladebildschirm.
- **M11 Wetter als Grip-Faktor der ganzen Strecke:** Regen multipliziert sich mit Untergrund-Zonen (Eis im Regen ist besonders rutschig) und wirkt über `gripAt` automatisch auf Physik und Bots. Nebel und Nacht ändern nur die Sicht. „Zufall“ wird beim Host einmal aufgelöst und im Start-Paket mitgeschickt.
- **M11 Chaos-Modus host-autoritativ mit Effekt-Timern:** Boxen, Minen, Drohnen und Treffer entscheidet der Host. Weil Clients ihr eigenes Auto lokal simulieren, schickt der Host nur Effekt-Timer (Betäubung, Verlangsamung, Schild, Boost) mit; der Client wendet sie mit derselben Funktion `applyCarEffect` an wie der Host. Eigener Zufallsstrom, damit ein Chaos-Rennen den Rest des Rennens nicht verändert.
- **M11 Ghost nur für die eigene Bestzeit:** Ein Weltbestzeit-Ghost bräuchte einen gemeinsamen Speicher (Server oder Gist mit Schreibrechten). Das widerspricht „kein eigener Server“ und „keine Geheimnisse im Repo“, also bleibt es beim eigenen Ghost im Browser.
- **M11 Replay im Ghost-Format:** Replay und Highlight-Clip nutzen dieselbe 0,1-s-Aufzeichnung wie der Ghost (Position und Gierwinkel, interpoliert). Das reicht für Kamera und Fotos, kostet wenig Speicher und lässt die Physik unangetastet; Neigung und Radstellung fehlen im Replay bewusst.
- **M11 Hupe per WebAudio statt Sample:** Bis das Audio-System in M12 kommt, erzeugt ein Zweiklang-Oszillator pro Automodell die Hupe. Kostenlos, ohne Download, und später leicht gegen CC0-Samples tauschbar.
- **M11 Zuschauer statt Abweisen:** Wer während eines Rennens beitritt, wird nicht mehr abgewiesen, sondern sieht über dieselben Snapshots zu und ist ab dem nächsten Start in der Aufstellung. Der Host muss dafür nichts extra rechnen.
- **M11 Rivalen pro Sitzung:** Rivalen gelten für einen Besuch (offline) bzw. einen Raum (online) und werden nicht gespeichert – Bot-Namen wiederholen sich zwischen Sitzungen, ein dauerhafter Rivale wäre verwirrend.

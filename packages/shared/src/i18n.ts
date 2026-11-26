/**
 * User interface languages.
 *
 * German is the source language of the UI texts. English translations are looked up here,
 * either as an exact phrase or through a pattern for texts that contain numbers or names.
 * Keeping all translations in one place lets the client switch language without touching
 * the game code.
 */

export type Lang = "de" | "en";
export const LANGS: Lang[] = ["de", "en"];

/** Exact German phrase → English. */
export const EN: Record<string, string> = {
  // Title and menu
  "Neon-Arcade-Racing für bis zu 10 Spieler – direkt im Browser.": "Neon arcade racing for up to 10 players – right in your browser.",
  "Rennen gegen Bots": "Race vs. bots",
  "Grand Prix": "Grand Prix",
  "Online spielen": "Play online",
  Garage: "Garage",
  Testgelände: "Test ground",
  "3 Runden · bis zu 10 Spieler · Enter startet ein Rennen gegen Bots": "3 laps · up to 10 players · Enter starts a race against bots",
  "Vorherige Strecke": "Previous track",
  "Nächste Strecke": "Next track",
  "Hafen bei Nacht, Zugbrücke ab Runde 2, Abkürzung durch die Lagerhalle": "Harbor at night, drawbridge from lap 2, shortcut through the warehouse",
  "ZUGBRÜCKE ÖFFNET SICH!": "DRAWBRIDGE OPENING!",
  "Dschungel und Tempelruinen, Wasserfall-Durchfahrt, Hangbrücke, Tempel-Abkürzung ab Runde 2": "Jungle and temple ruins, drive through a waterfall, rope bridge, temple shortcut from lap 2",
  "TEMPEL STÜRZT EIN – ABKÜRZUNG FREI!": "TEMPLE COLLAPSES – SHORTCUT OPEN!",
  "Wüstenschlucht im Abendlicht, großer Sprung, Steinschlag öffnet ab Runde 2 eine Abkürzung": "Desert canyon at sunset, big jump, a rockfall opens a shortcut from lap 2",
  "STEINSCHLAG – ABKÜRZUNG FREI!": "ROCKFALL – SHORTCUT OPEN!",
  "Hochhäuser und Rampen zwischen den Dächern": "Skyscrapers and ramps between the rooftops",
  "Klassische Rennstrecke, lange Geraden für den Windschatten": "Classic circuit, long straights for slipstreaming",
  "Gletscher mit Eisflächen (weniger Grip) und Polarlichtern": "Glacier with ice patches (less grip) and northern lights",
  "Early Access · weitere Strecken folgen": "Early access · more tracks coming",
  "APEX RUSH – Arcade-Rennspiel im Browser für bis zu 10 Spieler.": "APEX RUSH – browser arcade racer for up to 10 players.",
  "W/S Gas/Bremse · A/D Lenken · Leertaste Drift · Shift Nitro · R Zurücksetzen": "W/S throttle/brake · A/D steer · Space drift · Shift nitro · R reset",
  Zurück: "Back",
  OK: "OK",

  // Online
  "ONLINE SPIELEN": "PLAY ONLINE",
  "Erstelle einen Raum und teile den Code oder Link – bis zu 10 Spieler, kein Konto nötig.": "Create a room and share the code or link – up to 10 players, no account needed.",
  "Raum erstellen": "Create room",
  RAUMCODE: "ROOM CODE",
  Beitreten: "Join",
  "Der Raumcode hat 5 Zeichen, z. B. K7QXM.": "The room code has 5 characters, e.g. K7QXM.",
  "Raum wird erstellt …": "Creating room …",
  "Verbinde …": "Connecting …",
  LOBBY: "LOBBY",
  "Link kopieren": "Copy link",
  "Kopiert!": "Copied!",
  Verlassen: "Leave",
  Strecke: "Track",
  Runden: "Laps",
  "Mit Bots auffüllen": "Fill with bots",
  "Bis zu 10 Spieler · Freie Plätze füllen Bots · Verbindung direkt zwischen den Browsern": "Up to 10 players · bots fill free slots · direct connection between browsers",
  Bereit: "Ready",
  "Nicht bereit": "Not ready",
  bereit: "ready",
  wartet: "waiting",
  getrennt: "disconnected",
  Host: "Host",
  "Rennen starten": "Start race",
  "Warte, bis alle bereit sind": "Waiting until everyone is ready",
  "Das Rennen läuft schon.": "The race has already started.",
  "Der Raum ist voll.": "The room is full.",
  "Die Verbindung zum Host ist abgebrochen.": "The connection to the host was lost.",
  "Der Host startet das nächste Rennen.": "The host starts the next race.",
  Du: "You",
  "Dein Name": "Your name",

  // Race
  "FALSCHE RICHTUNG": "WRONG WAY",
  "PERFEKTSTART!": "PERFECT START!",
  "ZIEL!": "FINISH!",
  "fährt …": "racing …",
  ERGEBNIS: "RESULTS",
  Fahrer: "Driver",
  Zeit: "Time",
  "Beste Runde": "Best lap",
  Punkte: "Points",
  BESTE: "BEST",
  RUNDE: "LAP",
  Revanche: "Rematch",
  "Zum Menü": "Main menu",
  "Zur Lobby": "Back to lobby",
  "Cup-Siegerehrung": "Cup ceremony",
  KI: "AI",
  "Schnellste Runde": "Fastest lap",
  "Drift-König": "Drift king",
  "Meiste Überholungen": "Most overtakes",
  "Comeback des Rennens": "Comeback of the race",

  // Garage
  GARAGE: "GARAGE",
  Leistung: "Performance",
  Optik: "Looks",
  Topspeed: "Top speed",
  Beschleunigung: "Acceleration",
  Handling: "Handling",
  Drift: "Drift",
  Gewicht: "Weight",
  Nitro: "Nitro",
  Motor: "Engine",
  Getriebe: "Gearbox",
  Reifen: "Tires",
  Fahrwerk: "Suspension",
  Übersetzung: "Gear ratio",
  "kurz ↔ lang": "short ↔ long",
  Straße: "Street",
  Allwetter: "All-weather",
  Lack: "Paint",
  Felgen: "Rims",
  Unterboden: "Underglow",
  Reifenrauch: "Tire smoke",
  Folie: "Decal",
  Spoiler: "Spoiler",
  Startnummer: "Number",
  Hupe: "Horn",
  an: "on",
  aus: "off",
  Keine: "None",
  Streifen: "Stripes",
  Flammen: "Flames",
  Karo: "Checker",
  Blitz: "Lightning",
  Metallic: "Metallic",
  Matt: "Matte",
  Chrom: "Chrome",
  Farbe: "Color",
  Oberfläche: "Finish",
  Klassisch: "Classic",
  Doppelton: "Two-tone",
  Quietsch: "Squeak",
  gewählt: "selected",
  "Gewählt ✓": "Selected ✓",
  "Dieses Auto fahren": "Drive this car",
  "Auto gewählt": "Car selected",
  "Nicht genug Credits": "Not enough credits",
};

/** Patterns for texts with numbers or names (checked in order). */
const EN_PATTERNS: [RegExp, string][] = [
  [/^RUNDE (\d+)\/(\d+)$/, "LAP $1/$2"],
  [/^RUNDE (\d+)$/, "LAP $1"],
  [/^PLATZ (\d+)$/, "PLACE $1"],
  [/^SIEGER: (.*)$/, "WINNER: $1"],
  [/^GRAND PRIX · RENNEN (\d+)\/(\d+) · (.*)$/, "GRAND PRIX · RACE $1/$2 · $3"],
  [/^ERGEBNIS · (.*)$/, "RESULTS · $1"],
  [/^GESAMTWERTUNG nach (\d+)\/(\d+)$/, "STANDINGS after $1/$2"],
  [/^Nächstes Rennen \((\d+)\/(\d+)\)$/, "Next race ($1/$2)"],
  [/^Neu: (.*)$/, "New: $1"],
  [/^Fahrer-(\d+)$/, "Driver-$1"],
  [/^(.*) · (\d+) Runden · mit Bots$/, "$1 · $2 laps · with bots"],
  [/^(.*) · (\d+) Runden$/, "$1 · $2 laps"],
  [/^Raum konnte nicht erstellt werden: (.*)$/, "Could not create the room: $1"],
  [/^Beitreten fehlgeschlagen: (.*)$/, "Joining failed: $1"],
  [/^Dieses Auto wird ab Level (\d+) oder mit einem Grand-Prix-Sieg freigeschaltet\.$/, "This car unlocks at level $1 or with a Grand Prix win."],
  [/^Dieses Auto wird ab Level (\d+) freigeschaltet\.$/, "This car unlocks at level $1."],
  [/^🔒 Level (\d+) oder Cup-Sieg$/, "🔒 Level $1 or cup win"],
  [/^🔒 ab Level (\d+)$/, "🔒 from level $1"],
  [/^([\d.,]+) s gedriftet$/, "$1 s drifting"],
  [/^von Platz (\d+) auf (\d+)$/, "from P$1 to P$2"],
  [/^Leistungsindex \(Limit der Klasse: (\d+)\)$/, "Performance index (class limit: $1)"],
];

/** Translate a German UI text into the given language. Unknown texts stay unchanged. */
export function translate(text: string, lang: Lang): string {
  if (lang === "de") return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  const result = translateTrimmed(trimmed);
  if (result === null) return text;
  // keep surrounding whitespace so inline layout does not change
  const lead = text.slice(0, text.indexOf(trimmed));
  const trail = text.slice(text.indexOf(trimmed) + trimmed.length);
  return lead + result + trail;
}

function translateTrimmed(t: string): string | null {
  const exact = EN[t];
  if (exact !== undefined) return exact;
  for (const [re, out] of EN_PATTERNS) if (re.test(t)) return t.replace(re, out);
  // Garage labels with a price suffix, e.g. "Felgen · 200 Cr"
  const priced = /^(.+?)( · \d+ Cr)$/.exec(t);
  if (priced && EN[priced[1]!] !== undefined) return EN[priced[1]!]! + priced[2]!;
  return null;
}

/** Preferred language: stored choice, otherwise the browser language. */
export function detectLang(stored: string | null, browserLang: string | undefined): Lang {
  if (stored === "de" || stored === "en") return stored;
  return browserLang?.toLowerCase().startsWith("de") ? "de" : "en";
}

/** Netzwerk-Schicht von APEX RUSH (Peer-to-Peer, Host im Browser). */

export * from "./protocol";
export * from "./transport";
export * from "./interpolation";
export { PeerSignaling } from "./peerSignaling";

/** Erzeugt einen 5-stelligen Raumcode ohne verwechselbare Zeichen (0/O, 1/I). */
export function createRoomCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(random() * alphabet.length)];
  }
  return code;
}

/** Normalisiert eine Eingabe zu einem gültigen Raumcode oder `null`. */
export function parseRoomCode(input: string): string | null {
  const code = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-HJ-NP-Z2-9]{5}$/.test(code) ? code : null;
}

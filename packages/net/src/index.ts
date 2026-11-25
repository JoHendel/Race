/**
 * Netzwerk-Schicht von APEX RUSH (Peer-to-Peer, Host im Browser).
 * M0: nur die Schnittstelle. Die PeerJS-Umsetzung folgt in M3.
 */

/** Erzeugt einen 5-stelligen Raumcode ohne verwechselbare Zeichen (0/O, 1/I). */
export function createRoomCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(random() * alphabet.length)];
  }
  return code;
}

/** Austauschbarer Vermittlungsdienst für den Verbindungsaufbau (Signaling). */
export interface SignalingProvider {
  readonly name: string;
  host(roomCode: string): Promise<void>;
  join(roomCode: string): Promise<void>;
  close(): void;
}

import type { ClientMessage, HostMessage } from "./protocol";

/** Host-Seite: nimmt Verbindungen an und schickt Nachrichten an einzelne oder alle Clients. */
export interface HostTransport {
  onJoin(cb: (peerId: string) => void): void;
  onLeave(cb: (peerId: string) => void): void;
  onMessage(cb: (peerId: string, msg: ClientMessage) => void): void;
  send(peerId: string, msg: HostMessage): void;
  broadcast(msg: HostMessage): void;
  close(): void;
}

/** Client-Seite: eine Verbindung zum Host. */
export interface ClientTransport {
  onMessage(cb: (msg: HostMessage) => void): void;
  onClose(cb: () => void): void;
  send(msg: ClientMessage): void;
  close(): void;
}

/** Austauschbarer Vermittlungsdienst (PeerJS, lokal für Tests, …). */
export interface SignalingProvider {
  readonly name: string;
  host(roomCode: string): Promise<HostTransport>;
  join(roomCode: string): Promise<ClientTransport>;
}

type Envelope =
  | { kind: "join"; from: string }
  | { kind: "leave"; from: string }
  | { kind: "toHost"; from: string; msg: ClientMessage }
  | { kind: "toClient"; to: string | "*"; msg: HostMessage }
  | { kind: "hostHere" };

/**
 * Lokaler Vermittler über BroadcastChannel: verbindet Tabs desselben Browsers.
 * Für automatische Tests und zum Ausprobieren ohne Internet.
 */
export class LocalSignaling implements SignalingProvider {
  readonly name = "local";

  async host(roomCode: string): Promise<HostTransport> {
    const ch = new BroadcastChannel(`apex-${roomCode}`);
    const join: ((id: string) => void)[] = [];
    const leave: ((id: string) => void)[] = [];
    const message: ((id: string, m: ClientMessage) => void)[] = [];
    ch.onmessage = (e: MessageEvent<Envelope>) => {
      const env = e.data;
      if (env.kind === "join") join.forEach((cb) => cb(env.from));
      else if (env.kind === "leave") leave.forEach((cb) => cb(env.from));
      else if (env.kind === "toHost") message.forEach((cb) => cb(env.from, env.msg));
    };
    ch.postMessage({ kind: "hostHere" } satisfies Envelope);
    return {
      onJoin: (cb) => join.push(cb),
      onLeave: (cb) => leave.push(cb),
      onMessage: (cb) => message.push(cb),
      send: (to, msg) => ch.postMessage({ kind: "toClient", to, msg } satisfies Envelope),
      broadcast: (msg) => ch.postMessage({ kind: "toClient", to: "*", msg } satisfies Envelope),
      close: () => ch.close(),
    };
  }

  async join(roomCode: string): Promise<ClientTransport> {
    const ch = new BroadcastChannel(`apex-${roomCode}`);
    const me = `local-${Math.random().toString(36).slice(2, 10)}`;
    const message: ((m: HostMessage) => void)[] = [];
    const closed: (() => void)[] = [];
    ch.onmessage = (e: MessageEvent<Envelope>) => {
      const env = e.data;
      if (env.kind === "toClient" && (env.to === "*" || env.to === me)) message.forEach((cb) => cb(env.msg));
      if (env.kind === "hostHere") ch.postMessage({ kind: "join", from: me } satisfies Envelope);
    };
    ch.postMessage({ kind: "join", from: me } satisfies Envelope);
    window.addEventListener("beforeunload", () => ch.postMessage({ kind: "leave", from: me } satisfies Envelope));
    return {
      onMessage: (cb) => message.push(cb),
      onClose: (cb) => closed.push(cb),
      send: (msg) => ch.postMessage({ kind: "toHost", from: me, msg } satisfies Envelope),
      close: () => {
        ch.postMessage({ kind: "leave", from: me } satisfies Envelope);
        ch.close();
        closed.forEach((cb) => cb());
      },
    };
  }
}

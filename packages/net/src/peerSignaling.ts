import { Peer, type DataConnection } from "peerjs";
import type { ClientMessage, HostMessage } from "./protocol";
import type { ClientTransport, HostTransport, SignalingProvider } from "./transport";

const PREFIX = "apexrush-v1-";
const ICE: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:global.stun.twilio.com:3478" }];

function openPeer(id?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = id ? new Peer(id, { config: { iceServers: ICE } }) : new Peer({ config: { iceServers: ICE } });
    const timer = setTimeout(() => reject(new Error("Vermittlungsserver nicht erreichbar")), 12_000);
    peer.on("open", () => {
      clearTimeout(timer);
      resolve(peer);
    });
    peer.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/** Peer-to-Peer über den kostenlosen öffentlichen PeerJS-Server und WebRTC-Datenkanäle. */
export class PeerSignaling implements SignalingProvider {
  readonly name = "peerjs";

  async host(roomCode: string): Promise<HostTransport> {
    const peer = await openPeer(PREFIX + roomCode);
    const conns = new Map<string, DataConnection>();
    const join: ((id: string) => void)[] = [];
    const leave: ((id: string) => void)[] = [];
    const message: ((id: string, m: ClientMessage) => void)[] = [];
    peer.on("connection", (conn) => {
      conn.on("open", () => {
        conns.set(conn.peer, conn);
        join.forEach((cb) => cb(conn.peer));
      });
      conn.on("data", (data) => message.forEach((cb) => cb(conn.peer, data as ClientMessage)));
      conn.on("close", () => {
        conns.delete(conn.peer);
        leave.forEach((cb) => cb(conn.peer));
      });
    });
    return {
      onJoin: (cb) => join.push(cb),
      onLeave: (cb) => leave.push(cb),
      onMessage: (cb) => message.push(cb),
      send: (to, msg) => conns.get(to)?.send(msg),
      broadcast: (msg) => conns.forEach((c) => c.send(msg)),
      close: () => peer.destroy(),
    };
  }

  async join(roomCode: string): Promise<ClientTransport> {
    const peer = await openPeer();
    const conn = peer.connect(PREFIX + roomCode, { serialization: "json", reliable: true });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Raum nicht gefunden")), 12_000);
      conn.on("open", () => {
        clearTimeout(timer);
        resolve();
      });
      peer.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
    const message: ((m: HostMessage) => void)[] = [];
    const closed: (() => void)[] = [];
    conn.on("data", (data) => message.forEach((cb) => cb(data as HostMessage)));
    conn.on("close", () => closed.forEach((cb) => cb()));
    return {
      onMessage: (cb) => message.push(cb),
      onClose: (cb) => closed.push(cb),
      send: (msg) => conn.send(msg),
      close: () => peer.destroy(),
    };
  }
}

import type { LobbyPlayer, LobbySettings } from "@apex/net";
import { MAX_LAPS, MIN_LAPS, TRACKS, carById } from "@apex/shared";
import { escapeHtml } from "../game/raceScene";

export interface LobbyHandlers {
  isHost: boolean;
  code: string;
  clientId: string;
  name: string;
  onName: (name: string) => void;
  onReady: (ready: boolean) => void;
  onSettings: (patch: Partial<LobbySettings>) => void;
  onStart: () => void;
  onLeave: () => void;
}

/** Lobby-Bildschirm: Raumcode, Link, Spielerliste, Einstellungen, Bereit/Start. */
export class LobbyView {
  readonly root = document.createElement("div");
  private ready = false;

  constructor(
    parent: HTMLElement,
    private readonly h: LobbyHandlers,
  ) {
    const link = `${location.origin}${location.pathname}?room=${h.code}${location.search.includes("net=local") ? "&net=local" : ""}`;
    this.root.className = "panel lobby";
    this.root.innerHTML = `
      <div class="panel-card">
        <h2>LOBBY</h2>
        <div class="room">
          <div>
            <div class="label">RAUMCODE</div>
            <div class="code" data-testid="room-code">${h.code}</div>
          </div>
          <button class="btn btn-ghost small" data-action="copy">Link kopieren</button>
        </div>
        <label class="field">Dein Name
          <input data-field="name" maxlength="16" value="${escapeHtml(h.name)}" />
        </label>
        <ul class="players" data-testid="players"></ul>
        <div class="settings"></div>
        <div class="actions">
          <button class="btn btn-ghost" data-action="leave">Verlassen</button>
          ${h.isHost ? `<button class="btn" data-action="start" data-testid="start-race">Rennen starten</button>` : `<button class="btn" data-action="ready" data-testid="ready">Bereit</button>`}
        </div>
        <p class="hint">Bis zu 10 Spieler · Freie Plätze füllen Bots · Verbindung direkt zwischen den Browsern</p>
      </div>`;
    parent.appendChild(this.root);

    this.root.querySelector<HTMLButtonElement>("[data-action=copy]")!.onclick = async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      try {
        await navigator.clipboard.writeText(link);
        btn.textContent = "Kopiert!";
      } catch {
        btn.textContent = link;
      }
    };
    const nameInput = this.root.querySelector<HTMLInputElement>("[data-field=name]")!;
    nameInput.onchange = () => h.onName(nameInput.value);
    this.root.querySelector<HTMLButtonElement>("[data-action=leave]")!.onclick = () => h.onLeave();
    const start = this.root.querySelector<HTMLButtonElement>("[data-action=start]");
    if (start) start.onclick = () => h.onStart();
    const ready = this.root.querySelector<HTMLButtonElement>("[data-action=ready]");
    if (ready)
      ready.onclick = () => {
        this.ready = !this.ready;
        ready.textContent = this.ready ? "Nicht bereit" : "Bereit";
        ready.classList.toggle("btn-ghost", this.ready);
        h.onReady(this.ready);
      };
  }

  update(players: LobbyPlayer[], settings: LobbySettings, canStart: boolean): void {
    const list = this.root.querySelector(".players")!;
    list.innerHTML = players
      .map(
        (p) => `<li class="${p.clientId === this.h.clientId ? "me" : ""} ${p.connected ? "" : "offline"}">
          <span class="dot" style="background:#${p.color.toString(16).padStart(6, "0")}"></span>
          <span class="pname">${escapeHtml(p.name)}${p.isHost ? " <em>Host</em>" : ""}${p.car ? `<span class="car">${escapeHtml(carById(p.car.id).name)}</span>` : ""}</span>
          <span class="state">${!p.connected ? "getrennt" : p.ready ? "bereit" : "wartet"}</span>
        </li>`,
      )
      .join("");
    const track = TRACKS.find((t) => t.id === settings.trackId);
    const s = this.root.querySelector(".settings")!;
    if (this.h.isHost) {
      s.innerHTML = `
        <label class="field inline">Strecke <span>${track?.name ?? settings.trackId}</span></label>
        <label class="field inline">Runden
          <input type="number" data-field="laps" min="${MIN_LAPS}" max="${MAX_LAPS}" value="${settings.laps}" />
        </label>
        <label class="field inline"><input type="checkbox" data-field="bots" ${settings.fillWithBots ? "checked" : ""}/> Mit Bots auffüllen</label>`;
      const laps = s.querySelector<HTMLInputElement>("[data-field=laps]")!;
      laps.onchange = () => this.h.onSettings({ laps: Number(laps.value) });
      const bots = s.querySelector<HTMLInputElement>("[data-field=bots]")!;
      bots.onchange = () => this.h.onSettings({ fillWithBots: bots.checked });
      const start = this.root.querySelector<HTMLButtonElement>("[data-action=start]")!;
      start.disabled = !canStart;
      start.title = canStart ? "" : "Warte, bis alle bereit sind";
    } else {
      s.innerHTML = `<div class="summary">${track?.name ?? settings.trackId} · ${settings.laps} Runden${settings.fillWithBots ? " · mit Bots" : ""}</div>`;
    }
  }

  dispose(): void {
    this.root.remove();
  }
}

/** Kleines Overlay für Meldungen (Fehler, Verbindungsabbruch). */
export function showNotice(parent: HTMLElement, text: string, onOk: () => void): void {
  const el = document.createElement("div");
  el.className = "panel notice";
  el.innerHTML = `<div class="panel-card"><p>${escapeHtml(text)}</p><div class="actions"><button class="btn">OK</button></div></div>`;
  parent.appendChild(el);
  el.querySelector("button")!.onclick = () => {
    el.remove();
    onOk();
  };
}

import { trackById } from "@apex/shared";
import { escapeHtml } from "../game/grid";

/**
 * Track vote overlay: three track cards, live vote dots, a countdown, and a wheel that spins
 * across the tied tracks before stopping on the winner the host has drawn.
 */
export class VoteView {
  readonly root = document.createElement("div");
  private candidates: string[] = [];
  private myVote: string | null = null;
  private spinTimer = 0;

  constructor(
    parent: HTMLElement,
    private readonly clientId: string,
    private readonly onVote: (trackId: string) => void,
  ) {
    this.root.className = "panel vote";
    this.root.dataset.testid = "vote";
    parent.appendChild(this.root);
  }

  update(candidates: string[], votes: Record<string, string>, seconds: number): void {
    if (candidates.join() !== this.candidates.join()) {
      this.candidates = candidates;
      this.render();
    }
    this.myVote = votes[this.clientId] ?? this.myVote;
    const counts: Record<string, number> = {};
    for (const v of Object.values(votes)) counts[v] = (counts[v] ?? 0) + 1;
    for (const id of candidates) {
      const card = this.card(id);
      if (!card) continue;
      card.classList.toggle("mine", this.myVote === id);
      card.querySelector(".votes")!.textContent = "●".repeat(counts[id] ?? 0);
    }
    this.root.querySelector("[data-field=seconds]")!.textContent = String(seconds);
  }

  private card(id: string): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(`[data-track="${id}"]`);
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="panel-card">
        <h2>STRECKENWAHL</h2>
        <p class="hint">Stimme für eine Strecke · noch <b data-field="seconds">0</b> s</p>
        <div class="vote-cards">${this.candidates
          .map((id) => {
            const t = trackById(id);
            return `<button class="vote-card" data-track="${id}" data-testid="vote-${id}">
              <small>${t?.cup === "turbo" ? "Turbo Cup" : "Neon Cup"}</small>
              <b>${escapeHtml(t?.name ?? id)}</b>
              <span>${escapeHtml(t?.blurb ?? "")}</span>
              <i class="votes"></i>
            </button>`;
          })
          .join("")}</div>
        <p class="vote-result" data-field="result"></p>
      </div>`;
    for (const id of this.candidates)
      this.card(id)!.onclick = () => {
        this.myVote = id;
        this.onVote(id);
        for (const c of this.candidates) this.card(c)?.classList.toggle("mine", c === id);
      };
  }

  /** Show the result. With a tie the highlight runs around the tied tracks and slows down onto the winner. */
  showResult(winner: string, tie: string[], seconds: number): void {
    const result = this.root.querySelector<HTMLElement>("[data-field=result]");
    this.root.querySelectorAll<HTMLButtonElement>(".vote-card").forEach((b) => (b.disabled = true));
    const finish = () => {
      for (const c of this.candidates) this.card(c)?.classList.toggle("winner", c === winner);
      if (result) result.textContent = `STRECKE: ${(trackById(winner)?.name ?? winner).toUpperCase()}`;
    };
    if (tie.length < 2) {
      finish();
      return;
    }
    if (result) result.textContent = "GLÜCKSRAD!";
    // Spin: steps get slower, the last step lands on the winner
    const steps = tie.length * 5 + tie.indexOf(winner);
    const total = Math.max(1, seconds - 1) * 1000;
    let k = 0;
    const tick = () => {
      const id = tie[k % tie.length]!;
      for (const c of this.candidates) this.card(c)?.classList.toggle("spin", c === id);
      k++;
      if (k > steps) {
        for (const c of this.candidates) this.card(c)?.classList.remove("spin");
        finish();
        return;
      }
      const f = k / steps;
      this.spinTimer = window.setTimeout(tick, (total / steps) * (0.4 + 1.2 * f * f));
    };
    tick();
  }

  dispose(): void {
    window.clearTimeout(this.spinTimer);
    this.root.remove();
  }
}

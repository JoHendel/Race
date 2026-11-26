import { DEFAULT_KEYS, KEY_ACTIONS, KEY_ACTION_NAMES, keyLabel, rebind, RESERVED_KEYS, type KeyAction } from "@apex/shared";
import { a11y, setA11y } from "./a11ySettings";
import { escapeHtml } from "./game/grid";

/** Settings: colour-blind mode, sound captions and key bindings. */
export function showSettings(ui: HTMLElement, onBack: () => void): () => void {
  const el = document.createElement("div");
  el.className = "panel settings";
  el.dataset.testid = "settings";
  ui.appendChild(el);
  let waiting: KeyAction | null = null;

  const render = (): void => {
    const s = a11y();
    el.innerHTML = `
      <div class="panel-card">
        <h2>EINSTELLUNGEN</h2>
        <label class="toggle"><input type="checkbox" data-field="colorblind" ${s.colorblind ? "checked" : ""}/> Farbenblind-Modus <small>(gut unterscheidbare Fahrerfarben)</small></label>
        <label class="toggle"><input type="checkbox" data-field="captions" ${s.captions ? "checked" : ""}/> Untertitel für Geräusche <small>(Hupe, Treffer, letzte Runde …)</small></label>
        <h3>TASTENBELEGUNG</h3>
        <div class="keymap">
          ${KEY_ACTIONS.map(
            (a) => `<div class="km-row"><span>${KEY_ACTION_NAMES[a]}</span>
              <button class="btn btn-ghost small km-key ${waiting === a ? "waiting" : ""}" data-key="${a}" data-testid="key-${a}">${
                waiting === a ? "Taste drücken …" : s.keys[a].map((k) => `<span>${escapeHtml(keyLabel(k))}</span>`).join(" / ") || "–"
              }</button></div>`,
          ).join("")}
        </div>
        <p class="hint">Esc, Enter, Tab, M und 1–6 sind für Menü, Ton und Emotes reserviert.</p>
        <div class="actions">
          <button class="btn btn-ghost small" data-action="reset-keys">Standard</button>
          <button class="btn small" data-action="back" data-testid="settings-back">Zurück</button>
        </div>
      </div>`;
    el.querySelectorAll<HTMLInputElement>("input[data-field]").forEach((i) => {
      i.onchange = () => setA11y({ [i.dataset.field!]: i.checked });
    });
    el.querySelectorAll<HTMLButtonElement>("[data-key]").forEach((b) => {
      b.onclick = () => {
        waiting = b.dataset.key as KeyAction;
        render();
      };
    });
    el.querySelector<HTMLButtonElement>("[data-action=reset-keys]")!.onclick = () => {
      setA11y({ keys: { ...DEFAULT_KEYS } });
      waiting = null;
      render();
    };
    el.querySelector<HTMLButtonElement>("[data-action=back]")!.onclick = () => {
      close();
      onBack();
    };
  };

  const onKey = (e: KeyboardEvent): void => {
    if (!waiting) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code !== "Escape" && !RESERVED_KEYS.includes(e.code)) setA11y({ keys: rebind(a11y().keys, waiting, e.code) });
    waiting = null;
    render();
  };
  window.addEventListener("keydown", onKey, { capture: true });
  const close = (): void => {
    window.removeEventListener("keydown", onKey, { capture: true });
    el.remove();
  };
  render();
  return close;
}

import { SOUND_CAPTIONS } from "@apex/shared";
import { a11y } from "./a11ySettings";
import { sound } from "./audio/sound";

/** Subtitles for sounds that carry game information (on with the accessibility setting). */
let box: HTMLElement | null = null;

export function showCaption(text: string): void {
  if (!a11y().captions) return;
  if (!box) {
    box = document.createElement("div");
    box.className = "captions";
    box.dataset.testid = "captions";
    box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
  }
  const line = document.createElement("div");
  line.className = "caption";
  line.textContent = text;
  box.appendChild(line);
  while (box.children.length > 3) box.firstElementChild!.remove();
  window.setTimeout(() => line.remove(), 2600);
}

export function initCaptions(): void {
  sound.onPlay((name) => {
    const text = SOUND_CAPTIONS[name];
    if (text) showCaption(text);
  });
}

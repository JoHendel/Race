import { RepeatGate, navigate, padDirection } from "@apex/shared";

/**
 * Gamepad in menus: d-pad / left stick moves a focus ring between the visible buttons,
 * A (button 0) presses, B (button 1) goes back. Switched off while driving.
 */
const FOCUSABLE = "button:not([disabled]), input[type=range], input[type=checkbox], input[type=text], input:not([type])";
const BACK = "[data-action=back], [data-action=menu], [data-act=exit], .btn-back";

export function initGamepadNav(isDriving: () => boolean): void {
  const gate = new RepeatGate();
  let prevA = false;
  let prevB = false;
  let focused: HTMLElement | null = null;
  let last = performance.now();

  const visible = (): HTMLElement[] =>
    [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
      if (el.closest(".touch")) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" && el.offsetParent !== null;
    });

  const setFocus = (el: HTMLElement | null): void => {
    focused?.classList.remove("pad-focus");
    focused = el;
    if (el) {
      el.classList.add("pad-focus");
      el.focus({ preventScroll: true });
      el.scrollIntoView?.({ block: "nearest" });
    }
  };

  // a mouse or touch user does not want the ring
  window.addEventListener("pointerdown", () => setFocus(null), { capture: true });

  const tick = (): void => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    const pad = navigator.getGamepads?.().find((g) => g && g.connected) ?? null;
    if (pad && !isDriving()) {
      const buttons = pad.buttons.map((b) => b.pressed);
      const dir = padDirection(buttons, [...pad.axes]);
      const items = visible();
      if (focused && !items.includes(focused)) setFocus(null);
      if (gate.next(dir, dt) && dir && items.length) {
        const rects = items.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left, y: r.top, w: r.width, h: r.height };
        });
        const from = focused ? items.indexOf(focused) : -1;
        // first press: start on the first big button, not on a corner control
        const target = from < 0 ? (items.find((el) => el.classList.contains("btn")) ?? items[0]) : items[navigate(rects, from, dir)];
        // sliders: left/right change the value
        if (focused instanceof HTMLInputElement && focused.type === "range" && (dir === "left" || dir === "right") && target === focused) {
          focused.stepUp(dir === "right" ? 1 : -1);
          focused.dispatchEvent(new Event("input", { bubbles: true }));
        } else setFocus(target ?? null);
      }
      const a = buttons[0] ?? false;
      const b = buttons[1] ?? false;
      if (a && !prevA && focused) focused.click();
      if (b && !prevB) {
        const back = visible().find((el) => el.matches(BACK));
        if (back) back.click();
        else window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape" }));
      }
      prevA = a;
      prevB = b;
    } else {
      prevA = prevB = false;
      if (focused && isDriving()) setFocus(null);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

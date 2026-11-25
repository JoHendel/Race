import { detectLang, translate, type Lang } from "@apex/shared";

/**
 * Switches the whole HTML overlay between German and English.
 *
 * The UI is written in German; a MutationObserver translates every text node and a few
 * attributes as soon as they appear. For each node the original German text is kept, so
 * switching back to German restores it without re-rendering any screen.
 */

const STORAGE_KEY = "apexrush.lang";
const ATTRS = ["placeholder", "title", "aria-label"] as const;

interface Entry {
  orig: string;
  out: string;
}

const textEntries = new WeakMap<Text, Entry>();
const attrEntries = new WeakMap<Element, Map<string, Entry>>();
let lang: Lang = "de";
let observer: MutationObserver | null = null;
const listeners: ((l: Lang) => void)[] = [];

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(l: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    // storage unavailable (private mode) – language just isn't remembered
  }
}

function processText(node: Text): void {
  const cur = node.data;
  const entry = textEntries.get(node);
  const orig = entry && cur === entry.out ? entry.orig : cur;
  const out = translate(orig, lang);
  textEntries.set(node, { orig, out });
  if (out !== cur) node.data = out;
}

function processAttrs(el: Element): void {
  for (const name of ATTRS) {
    const cur = el.getAttribute(name);
    if (cur === null) continue;
    let map = attrEntries.get(el);
    if (!map) attrEntries.set(el, (map = new Map()));
    const entry = map.get(name);
    const orig = entry && cur === entry.out ? entry.orig : cur;
    const out = translate(orig, lang);
    map.set(name, { orig, out });
    if (out !== cur) el.setAttribute(name, out);
  }
}

function processTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) return processText(root as Text);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (el.closest("[data-no-translate]")) return;
  processAttrs(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) processText(n as Text);
    else processAttrs(n as Element);
  }
}

export function currentLang(): Lang {
  return lang;
}

export function onLangChange(fn: (l: Lang) => void): void {
  listeners.push(fn);
}

export function setLang(l: Lang): void {
  lang = l;
  store(l);
  document.documentElement.lang = l;
  processTree(document.body);
  for (const fn of listeners) fn(l);
}

/** Install the translator. `?lang=de|en` in the URL overrides the stored choice. */
export function initI18n(urlLang: string | null): void {
  lang = detectLang(urlLang ?? readStored(), navigator.language);
  document.documentElement.lang = lang;
  processTree(document.body);
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") processText(r.target as Text);
      else if (r.type === "attributes") processAttrs(r.target as Element);
      else r.addedNodes.forEach((n) => processTree(n));
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}

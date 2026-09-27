import { useSyncExternalStore } from "react";
import hi from "./hi.json";

export type Language = "en" | "hi";
const key = "janpratinidhi-language";
let language: Language = "en";
try {
  language = localStorage.getItem(key) === "hi" ? "hi" : "en";
} catch {
  /* Storage is optional. */
}
const listeners = new Set<() => void>();
const dictionary: Record<string, string> = hi;
function syncDocument() {
  document.documentElement.lang = language;
  document.title =
    language === "hi"
      ? "जन प्रतिनिधि | अपने प्रतिनिधियों को जानें"
      : "Jan Pratinidhi | Know your representatives";
}
syncDocument();
export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem(key, next);
  } catch {
    /* Keep the session preference. */
  }
  syncDocument();
  listeners.forEach((listener) => listener());
}
window.addEventListener("storage", (event) => {
  if (event.key === key) {
    language = event.newValue === "hi" ? "hi" : "en";
    syncDocument();
    listeners.forEach((listener) => listener());
  }
});
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useLanguage() {
  return useSyncExternalStore(subscribe, () => language);
}
/** Translate interface copy only. Source records and submitted values stay unchanged. */
export function t(text: string, values: Record<string, string | number> = {}): string {
  const result = language === "hi" ? (dictionary[text] ?? text) : text;
  return result.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
export function locale() {
  return language === "hi" ? "hi-IN" : "en-IN";
}

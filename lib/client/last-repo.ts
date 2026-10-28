"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

const KEY = "cbg-last-repo";

export function rememberRepo(repo: { id: string; name: string }) {
  try {
    localStorage.setItem(KEY, JSON.stringify(repo));
    window.dispatchEvent(new Event("cbg-repo"));
  } catch {}
}

export function forgetRepo(id: string) {
  try {
    const cur = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (cur?.id === id) localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("cbg-repo"));
  } catch {}
}

/** The repository the user last worked in (per browser), so repo-scoped nav items have a target. */
export function useLastRepo() {
  const [repo, setRepo] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        setRepo(JSON.parse(localStorage.getItem(KEY) ?? "null"));
      } catch {
        setRepo(null);
      }
    };
    read();
    window.addEventListener("cbg-repo", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("cbg-repo", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return repo;
}

export function setTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("cbg-theme", theme);
  } catch {}
  window.dispatchEvent(new Event("cbg-theme"));
}

function subscribeTheme(cb: () => void) {
  window.addEventListener("cbg-theme", cb);
  return () => window.removeEventListener("cbg-theme", cb);
}

/** Current theme from the <html data-theme> attribute (set before paint by the root layout). */
export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    () => "dark",
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "dark" | "light";

type ThemeCtx = {
  theme: Theme;
  /** Toggles theme. Optional origin coordinates trigger the circular wipe overlay
   *  centered on those screen-relative coordinates (CSS px). */
  toggle: (origin?: { x: number; y: number }) => void;
  setTheme: (t: Theme, origin?: { x: number; y: number }) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "honsell.theme";
const THEME_REVEAL_DURATION_MS = 720;

type ViewTransitionHandle = {
  ready: Promise<void>;
  finished: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => ViewTransitionHandle;
};

/** Theme bootstrap script — runs synchronously before React hydration to avoid
 *  flash of the wrong palette. Reads localStorage / falls back to system pref. */
export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  try {
    var raw = localStorage.getItem("${STORAGE_KEY}");
    var t = (raw === "dark" || raw === "light") ? raw :
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    var root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(t);
    root.dataset.theme = t;
  } catch (e) {}
})();`;

export function ThemeProvider({
  children,
  initial = "dark",
}: {
  children: React.ReactNode;
  initial?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initial);

  // Hydrate from DOM (set by THEME_BOOTSTRAP_SCRIPT before React mounts).
  useEffect(() => {
    if (typeof document === "undefined") return;
    const cls = document.documentElement.classList;
    const fromDom: Theme = cls.contains("light") ? "light" : "dark";
    setThemeState(fromDom);
  }, []);

  const applyTheme = useCallback(
    (next: Theme, origin?: { x: number; y: number }) => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      const viewTransitionDocument = document as ViewTransitionDocument;
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function commit() {
        root.classList.remove("dark", "light");
        root.classList.add(next);
        root.dataset.theme = next;
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* localStorage may be blocked */
        }
        setThemeState(next);
      }

      if (origin && !reducedMotion && viewTransitionDocument.startViewTransition) {
        const { x, y } = origin;
        root.classList.add("theme-circle-transition");
        root.style.setProperty("--theme-reveal-x", `${x}px`);
        root.style.setProperty("--theme-reveal-y", `${y}px`);

        const transition = viewTransitionDocument.startViewTransition(commit);
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );

        transition.ready
          .then(() => {
            root.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${radius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration: THEME_REVEAL_DURATION_MS,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                pseudoElement: "::view-transition-new(root)",
              } as KeyframeAnimationOptions & { pseudoElement: string },
            );
          })
          .catch(() => {
            /* View Transition may be cancelled by navigation or browser state. */
          })
          .finally(() => {
            window.setTimeout(() => {
              root.classList.remove("theme-circle-transition");
              root.style.removeProperty("--theme-reveal-x");
              root.style.removeProperty("--theme-reveal-y");
            }, THEME_REVEAL_DURATION_MS + 80);
          });
        return;
      }

      root.classList.add("theme-soft-transition");
      commit();
      if (!reducedMotion) {
        window.setTimeout(() => {
          root.classList.remove("theme-soft-transition");
        }, 520);
      } else {
        root.classList.remove("theme-soft-transition");
      }
    },
    [],
  );

  const toggle = useCallback(
    (origin?: { x: number; y: number }) => {
      applyTheme(theme === "dark" ? "light" : "dark", origin);
    },
    [applyTheme, theme],
  );

  const setTheme = useCallback(
    (t: Theme, origin?: { x: number; y: number }) => {
      applyTheme(t, origin);
    },
    [applyTheme],
  );

  return (
    <Ctx.Provider value={{ theme, toggle, setTheme }}>{children}</Ctx.Provider>
  );
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

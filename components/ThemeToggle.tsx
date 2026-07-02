"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import styles from "./ThemeToggle.module.css";

export default function ThemeToggle() {
  const pathname = usePathname() ?? "/";
  const { theme, setTheme } = useTheme();
  const lightBtnRef = useRef<HTMLButtonElement>(null);
  const darkBtnRef = useRef<HTMLButtonElement>(null);

  if (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return null;
  }

  const isDark = theme === "dark";

  function handlePick(next: "light" | "dark") {
    if (theme === next) return;
    const el = next === "light" ? lightBtnRef.current : darkBtnRef.current;
    if (!el) {
      setTheme(next);
      return;
    }
    const r = el.getBoundingClientRect();
    setTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  return (
    <div
      id="theme-toggle"
      role="radiogroup"
      aria-label="Mövzu rejimi"
      data-theme={isDark ? "dark" : "light"}
      className={`${styles.switch} ${isDark ? styles.dark : styles.light} fixed left-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[110] xl:bottom-6 xl:left-5`}
    >
      <span className={styles.railHighlight} aria-hidden />
      <span className={styles.starField} aria-hidden>
        <i /><i /><i /><i />
      </span>

      <Sun className={`${styles.ghostIcon} ${styles.ghostSun}`} aria-hidden />
      <Moon className={`${styles.ghostIcon} ${styles.ghostMoon}`} aria-hidden />

      <span className={styles.orb} aria-hidden>
        <span className={`${styles.orbFace} ${styles.sunFace}`}>
          <Sun />
          <i className={styles.sunGlint} />
        </span>
        <span className={`${styles.orbFace} ${styles.moonFace}`}>
          <Moon />
          <i className={`${styles.crater} ${styles.craterOne}`} />
          <i className={`${styles.crater} ${styles.craterTwo}`} />
        </span>
      </span>

      <button
        ref={lightBtnRef}
        type="button"
        role="radio"
        aria-checked={!isDark}
        aria-label="İşıqlı rejimə keç"
        title="İşıqlı rejim"
        onClick={() => handlePick("light")}
        className={`${styles.option} ${styles.lightOption}`}
      />

      <button
        ref={darkBtnRef}
        type="button"
        role="radio"
        aria-checked={isDark}
        aria-label="Qaranlıq rejimə keç"
        title="Qaranlıq rejim"
        onClick={() => handlePick("dark")}
        className={`${styles.option} ${styles.darkOption}`}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
      title={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      aria-label="Toggle theme"
      suppressHydrationWarning
      className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      {mounted ? (
        isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4 opacity-0" />
      )}
    </button>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type PriceData = {
  price: number;
  change: number | null;
  changePct: number | null;
};

export function PriceTicker() {
  const [data, setData] = useState<PriceData | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevPrice = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const r = await fetch("/api/market/price");
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled || typeof d.price !== "number") return;

        if (prevPrice.current != null && d.price !== prevPrice.current) {
          setFlash(d.price > prevPrice.current ? "up" : "down");
          setTimeout(() => !cancelled && setFlash(null), 700);
        }
        prevPrice.current = d.price;
        setData({ price: d.price, change: d.change, changePct: d.changePct });
      } catch {}
    }

    fetchPrice();
    const id = setInterval(fetchPrice, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data) return null;

  const up = (data.change ?? 0) >= 0;
  const Arrow = up ? TrendingUp : TrendingDown;

  return (
    <div
      title="XAUUSD (COMEX gold ≈ spot)"
      className={cn(
        "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30 transition-colors",
        flash === "up" && "bg-emerald-400/10 border-emerald-400/40",
        flash === "down" && "bg-red-400/10 border-red-400/40"
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        XAU/USD
      </span>
      <span className="text-sm font-semibold tabular tracking-tight">
        {data.price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
      {data.change != null && (
        <span
          className={cn(
            "flex items-center gap-0.5 text-[11px] font-medium tabular",
            up ? "text-emerald-400" : "text-red-400"
          )}
        >
          <Arrow className="w-3 h-3" />
          {up ? "+" : ""}
          {data.changePct != null ? `${data.changePct.toFixed(2)}%` : data.change.toFixed(2)}
        </span>
      )}
    </div>
  );
}

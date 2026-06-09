import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Primary: spot gold (matches TradingView XAU/USD). Fallback: Yahoo GC=F futures.
const YAHOO_TICKER = "GC=F";
const GOLD_API_URL = "https://api.gold-api.com/price/XAU";
const CACHE_TTL_MS = 15_000;

type PriceSnapshot = {
  symbol: string;
  price: number;
  // Futures (GC=F) price the bot trades on — use this to value open positions.
  refPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  currency: string | null;
  marketState: string | null;
  fetchedAt: number;
};

let cache: PriceSnapshot | null = null;

async function fetchYahooPrice(): Promise<PriceSnapshot | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${YAHOO_TICKER}?interval=1m&range=1d`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AITrader/1.0)" },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const json = await r.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? meta.previousClose;
    if (!price || price <= 0) return null;

    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
    const change = previousClose != null ? price - previousClose : null;
    const changePct =
      previousClose != null && previousClose !== 0
        ? (change! / previousClose) * 100
        : null;

    return {
      symbol: "XAUUSD",
      price: Math.round(price * 100) / 100,
      refPrice: Math.round(price * 100) / 100,
      previousClose,
      change: change != null ? Math.round(change * 100) / 100 : null,
      changePct: changePct != null ? Math.round(changePct * 100) / 100 : null,
      currency: meta.currency ?? "USD",
      marketState: meta.marketState ?? null,
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function fetchSpotPrice(): Promise<number | null> {
  try {
    const r = await fetch(GOLD_API_URL, {
      headers: { "User-Agent": "AITrader/1.0" },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const json = await r.json();
    const price = json?.price;
    return price && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache);
  }

  // Spot price (matches TradingView) + Yahoo day-change % (basis cancels in % terms).
  const [spot, yahoo] = await Promise.all([fetchSpotPrice(), fetchYahooPrice()]);

  if (spot != null) {
    const changePct = yahoo?.changePct ?? null;
    const change =
      changePct != null ? Math.round(((spot * changePct) / 100) * 100) / 100 : null;
    const snapshot: PriceSnapshot = {
      symbol: "XAUUSD",
      price: Math.round(spot * 100) / 100,
      refPrice: yahoo?.price ?? null,
      previousClose: change != null ? Math.round((spot - change) * 100) / 100 : null,
      change,
      changePct,
      currency: "USD",
      marketState: yahoo?.marketState ?? null,
      fetchedAt: Date.now(),
    };
    cache = snapshot;
    return NextResponse.json(snapshot);
  }

  // Spot source down — fall back to Yahoo futures price entirely.
  if (yahoo) {
    cache = yahoo;
    return NextResponse.json(yahoo);
  }

  // Both upstreams failed — serve stale cache if we have it.
  if (cache) {
    return NextResponse.json({ ...cache, stale: true });
  }

  return NextResponse.json({ error: "Price unavailable" }, { status: 502 });
}

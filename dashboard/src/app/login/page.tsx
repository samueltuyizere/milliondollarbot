"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TrendingUp, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Particle / node data (deterministic from index) ───────────────────────

const PARTICLES = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  x: (i * 37 + 11) % 96,
  y: (i * 53 + 7) % 96,
  size: 1.5 + (i % 3) * 0.8,
  opacity: 0.18 + (i % 5) * 0.06,
  duration: `${20 + (i % 9) * 2.5}s`,
  delay: `${-(i * 1.1)}s`,
}));

const NODES = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  x: 4 + (i * 47 + 13) % 84,
  y: 4 + (i * 59 + 19) % 84,
  size: 5 + (i % 3) * 2,
  duration: `${4 + (i % 5) * 0.7}s`,
  delay: `${-(i * 0.55)}s`,
}));

// XAUUSD price sparkline
const SPARKLINE =
  "M 0 76 C 14 72, 22 60, 36 55 C 48 50, 56 68, 70 49 " +
  "C 82 34, 95 52, 114 39 C 130 28, 140 46, 162 32 " +
  "C 178 21, 192 39, 214 26 C 229 16, 242 34, 266 21 " +
  "C 282 12, 297 28, 320 17 C 337 8, 350 23, 376 12 L 400 10";
const AREA = SPARKLINE + " L 400 100 L 0 100 Z";

// ─── Digital clock ──────────────────────────────────────────────────────────

function DigitalClock() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = mounted && now ? pad(now.getHours()) : "00";
  const mm = mounted && now ? pad(now.getMinutes()) : "00";
  const ss = mounted && now ? pad(now.getSeconds()) : "00";
  const dateStr =
    mounted && now
      ? now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "";

  const glass: React.CSSProperties = {
    background: "rgba(0,0,0,0.42)",
    border: "1px solid rgba(209,158,0,0.16)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  };

  return (
    <div
      className="rounded-2xl px-10 py-7 flex flex-col items-center gap-4"
      style={glass}
    >
      {/* Time row */}
      <div className="flex items-center gap-1.5" suppressHydrationWarning>
        {/* HH */}
        <span className="text-[68px] font-bold font-mono text-white tabular-nums leading-none tracking-tight">
          {hh}
        </span>
        <span
          className="text-[52px] font-mono font-bold text-white/25 leading-none select-none mb-1"
          style={{ animation: "auth-clock-blink 1s ease-in-out infinite" }}
        >
          :
        </span>
        {/* MM */}
        <span className="text-[68px] font-bold font-mono text-white tabular-nums leading-none tracking-tight">
          {mm}
        </span>
        <span
          className="text-[52px] font-mono font-bold text-white/25 leading-none select-none mb-1"
          style={{ animation: "auth-clock-blink 1s ease-in-out infinite" }}
        >
          :
        </span>
        {/* SS — smaller */}
        <span className="text-[36px] font-bold font-mono text-white/60 tabular-nums leading-none tracking-tight self-end mb-1">
          {ss}
        </span>
      </div>

      {/* Divider */}
      <div className="w-full h-px" style={{ background: "rgba(209,158,0,0.10)" }} />

      {/* Date */}
      <p
        className="text-[11px] font-medium tracking-[0.14em] uppercase"
        style={{ color: "rgba(209,158,0,0.55)" }}
        suppressHydrationWarning
      >
        {dateStr || "Loading…"}
      </p>
    </div>
  );
}

// ─── Hero panel ──────────────────────────────────────────────────────────────

function HeroPanel() {
  return (
    <div
      className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center"
      style={{
        background:
          "linear-gradient(145deg, oklch(0.07 0.012 255) 0%, oklch(0.10 0.016 250) 40%, oklch(0.085 0.010 258) 70%, oklch(0.075 0.012 255) 100%)",
      }}
    >
      {/* Dot-grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(209,158,0,0.18) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Radial mesh glows */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            "radial-gradient(ellipse 60% 40% at 50% 10%, rgba(209,158,0,0.11) 0%, transparent 65%)",
            "radial-gradient(ellipse 45% 50% at 85% 80%, rgba(209,158,0,0.08) 0%, transparent 55%)",
            "radial-gradient(ellipse 60% 50% at 0% 0%, rgba(0,0,0,0.60) 0%, transparent 55%)",
            "radial-gradient(ellipse 50% 45% at 100% 100%, rgba(0,0,0,0.50) 0%, transparent 50%)",
          ].join(", "),
        }}
      />

      {/* Particles */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: `rgba(209,158,0,${p.opacity})`,
            boxShadow: `0 0 ${p.size * 3}px rgba(209,158,0,${p.opacity * 0.6})`,
            animation: `auth-drift ${p.duration} ease-in-out ${p.delay} infinite`,
          }}
        />
      ))}

      {/* Network nodes */}
      {NODES.map((n) => (
        <div
          key={n.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${n.x}%`,
            top: `${n.y}%`,
            width: `${n.size}px`,
            height: `${n.size}px`,
            border: "1.5px solid rgba(209,158,0,0.30)",
            boxShadow: "0 0 12px rgba(209,158,0,0.18)",
            animation: `auth-pulse-node ${n.duration} ease-in-out ${n.delay} infinite`,
          }}
        />
      ))}

      {/* ── Central content ── */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-10 max-w-[500px] w-full">

        {/* Live clock — the hero element */}
        <DigitalClock />

        {/* Compact XAUUSD chart */}
        <div
          className="w-full rounded-xl overflow-hidden"
          style={{
            background: "rgba(0,0,0,0.32)",
            border: "1px solid rgba(209,158,0,0.12)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.14em]">
                XAU/USD
              </span>
              <span className="text-[17px] font-mono font-bold text-amber-300 tracking-tight">
                2,384.50
              </span>
              <span className="text-[11px] font-semibold text-emerald-400">+0.52%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                style={{ animation: "auth-glow-breathe 2s ease-in-out infinite" }}
              />
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Live</span>
            </div>
          </div>

          {/* Sparkline */}
          <div style={{ animation: "auth-bars-float 14s ease-in-out infinite" }}>
            <svg viewBox="0 0 400 100" height={56} className="w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lg-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(209,158,0,0.25)" />
                  <stop offset="100%" stopColor="rgba(209,158,0,0)" />
                </linearGradient>
                <linearGradient id="lg-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(209,158,0,0.3)" />
                  <stop offset="100%" stopColor="rgba(209,158,0,1)" />
                </linearGradient>
                <filter id="glow-line" x="-5%" y="-60%" width="110%" height="220%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path d={AREA} fill="url(#lg-area)" />
              <path d={SPARKLINE} fill="none" stroke="url(#lg-line)" strokeWidth="2" filter="url(#glow-line)" />
              <circle cx="400" cy="10" r="3.5" fill="rgba(209,158,0,1)" />
              <circle cx="400" cy="10" r="7" fill="rgba(209,158,0,0.22)" />
            </svg>
          </div>

          {/* Stats footer */}
          <div className="flex divide-x border-t" style={{ borderColor: "rgba(209,158,0,0.08)", borderTopColor: "rgba(209,158,0,0.08)" }}>
            {[
              { label: "Spread", value: "0.18" },
              { label: "High", value: "2,391.20" },
              { label: "Low", value: "2,368.40" },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 px-3 py-2 text-center" style={{ borderColor: "rgba(209,158,0,0.08)" }}>
                <p className="text-[9px] text-white/25 uppercase tracking-widest mb-0.5">{label}</p>
                <p className="text-[11px] font-mono font-semibold text-white/50">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Brand — pinned to bottom */}
      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-1 z-10">
        <p className="text-[13px] font-semibold text-white/40 tracking-tight">
          XAUUSD Bot Control System
        </p>
        <p className="text-[10px] text-white/20 tracking-wide uppercase">
          Automated precision trading · FundedNext Phase 1
        </p>
      </div>
    </div>
  );
}

// ─── Login page ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── LEFT: Form panel ───────────────────────────────────── */}
      <div className="w-full lg:w-[44%] flex flex-col border-r border-border bg-card">

        {/* Wordmark */}
        <div className="flex items-center gap-3 px-10 pt-10">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(209,158,0,0.25), rgba(209,158,0,0.08))",
              border: "1px solid rgba(209,158,0,0.30)",
              boxShadow: "0 4px 20px rgba(209,158,0,0.12)",
            }}
          >
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[15px] font-bold tracking-[-0.03em]">AITrader</p>
            <p className="text-[10px] text-muted-foreground/60 tracking-wide uppercase">
              XAUUSD Bot Control
            </p>
          </div>
        </div>

        {/* Form — vertically centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-8">
          <div className="w-full max-w-[340px]">

            <div className="mb-8">
              <h1 className="text-[28px] font-bold tracking-[-0.04em] leading-tight">
                Welcome back
              </h1>
              <p className="text-[13px] text-muted-foreground mt-1.5">
                Sign in to your trading dashboard
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-[--loss]/30 bg-[--loss]/8 px-3.5 py-2.5 text-[13px] text-[--loss] mb-5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[--loss] flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[12px] font-medium text-muted-foreground">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="trader@example.com"
                    required
                    className="h-10 pl-10 text-[13px]"
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[12px] font-medium text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-10 pl-10 pr-10 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 text-[13px] font-semibold"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                      Signing in…
                    </span>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 pb-8 text-center">
          <p className="text-[11px] text-muted-foreground/40">
            Local access only · © 2026 AITrader
          </p>
        </div>
      </div>

      {/* ── RIGHT: Hero panel ─────────────────────────────────── */}
      <div className="hidden lg:block flex-1 relative overflow-hidden">
        <HeroPanel />
      </div>
    </div>
  );
}

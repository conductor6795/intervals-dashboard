"use client";
import { clsx } from "clsx";
import { DailySummary, RingSummary, SummaryLevel } from "@/lib/dailySummary";

const LEVEL_STYLE: Record<SummaryLevel, { ring: string; text: string }> = {
  good: { ring: "stroke-emerald-500", text: "text-emerald-400" },
  ok:   { ring: "stroke-yellow-400",  text: "text-yellow-400" },
  warn: { ring: "stroke-orange-500",  text: "text-orange-400" },
  bad:  { ring: "stroke-red-500",     text: "text-red-400" },
};

function RingGauge({ item }: { item: RingSummary }) {
  const style = LEVEL_STYLE[item.level];
  const r = 34;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, item.pct));
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center text-center gap-2.5 flex-1 min-w-0">
      <div className="relative w-[92px] h-[92px] shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1e2d4a" strokeWidth="7" />
          <circle
            cx="40" cy="40" r={r} fill="none"
            strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            className={clsx(style.ring, "transition-all duration-700")}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={clsx("text-xl font-bold tabular-nums leading-none", style.text)}>{item.displayValue}</span>
          {item.sub && <span className="text-[10px] text-dash-muted mt-1">{item.sub}</span>}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[12px] text-dash-muted uppercase tracking-wider font-semibold">{item.label}</p>
        <p className={clsx("text-[12px] mt-1 leading-snug line-clamp-2 max-w-[170px]", style.text)}>{item.coach}</p>
      </div>
    </div>
  );
}

export default function DailyRings({ summary }: { summary: DailySummary }) {
  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-5 flex flex-col justify-center h-full">
      <p className="text-[11px] text-dash-muted uppercase tracking-wider font-medium mb-5">Tagesüberblick</p>
      <div className="flex items-start justify-around gap-3 flex-1">
        <RingGauge item={summary.load} />
        <RingGauge item={summary.recovery} />
        <RingGauge item={summary.sleep} />
      </div>
    </div>
  );
}

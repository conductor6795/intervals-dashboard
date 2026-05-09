"use client";
import { clsx } from "clsx";

interface Props {
  value: number;
}

function color(v: number) {
  if (v >= 75) return { ring: "stroke-emerald-500", text: "text-emerald-400", label: "Bereit", bg: "bg-emerald-500/10" };
  if (v >= 50) return { ring: "stroke-yellow-400", text: "text-yellow-400", label: "Moderat", bg: "bg-yellow-400/10" };
  if (v >= 25) return { ring: "stroke-orange-500", text: "text-orange-400", label: "Eingeschränkt", bg: "bg-orange-500/10" };
  return { ring: "stroke-red-500", text: "text-red-400", label: "Ruhetag", bg: "bg-red-500/10" };
}

export default function TrainingReadiness({ value }: Props) {
  const c = color(value);
  const r = 40;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <div className={clsx("flex flex-col items-center justify-center p-5 rounded-xl border border-dash-border", c.bg)}>
      <span className="text-xs text-dash-muted mb-3 uppercase tracking-wider">Trainingsbereitschaft</span>
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1e2d4a" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            className={c.ring}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={clsx("text-2xl font-bold tabular-nums", c.text)}>{value}</span>
          <span className="text-[10px] text-dash-muted">/100</span>
        </div>
      </div>
      <span className={clsx("mt-2 text-sm font-medium", c.text)}>{c.label}</span>
    </div>
  );
}

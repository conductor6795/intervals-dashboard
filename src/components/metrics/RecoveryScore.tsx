"use client";
import { clsx } from "clsx";

interface Props {
  value: number;
}

function color(v: number) {
  if (v >= 75) return { bar: "bg-emerald-500", text: "text-emerald-400", label: "Gut erholt" };
  if (v >= 50) return { bar: "bg-yellow-400", text: "text-yellow-400", label: "Teilerholt" };
  if (v >= 25) return { bar: "bg-orange-500", text: "text-orange-400", label: "Ermüdet" };
  return { bar: "bg-red-500", text: "text-red-400", label: "Überlastet" };
}

export default function RecoveryScore({ value }: Props) {
  const c = color(value);
  return (
    <div className="flex flex-col p-5 rounded-2xl border border-dash-border bg-dash-card h-full justify-center">
      <span className="text-xs text-dash-muted uppercase tracking-wider mb-3">Erholung</span>
      <div className="flex items-end gap-2 mb-3">
        <span className={clsx("text-4xl font-bold tabular-nums", c.text)}>{value}</span>
        <span className="text-dash-muted text-sm pb-1">%</span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-dash-border overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all duration-700", c.bar)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={clsx("mt-2 text-xs font-medium", c.text)}>{c.label}</span>
    </div>
  );
}

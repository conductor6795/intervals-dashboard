"use client";
import { clsx } from "clsx";
import { Period, PERIODS, PERIOD_LABELS } from "@/hooks/usePeriod";

interface Props {
  value: Period;
  onChange: (p: Period) => void;
  className?: string;
}

export default function PeriodSelector({ value, onChange, className }: Props) {
  return (
    <div
      className={clsx(
        "flex items-center gap-1 bg-dash-card border border-dash-border rounded-xl p-1",
        className
      )}
    >
      {PERIODS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={clsx(
            "text-[11px] px-2.5 py-1 rounded-lg transition-colors font-medium",
            value === p ? "text-white" : "text-dash-muted hover:text-white"
          )}
          style={value === p ? { backgroundColor: "var(--a-600)" } : {}}
        >
          {PERIOD_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

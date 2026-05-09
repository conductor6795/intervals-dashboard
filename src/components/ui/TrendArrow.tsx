"use client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { clsx } from "clsx";

interface TrendArrowProps {
  trend: "up" | "neutral" | "down";
  /** true = Anstieg ist gut (grün). false = Anstieg ist schlecht (z.B. RHR, Ermüdung) */
  positiveIsGood?: boolean;
  size?: number;
  className?: string;
}

export default function TrendArrow({
  trend,
  positiveIsGood = true,
  size = 12,
  className,
}: TrendArrowProps) {
  const isGood =
    trend === "neutral"
      ? null
      : positiveIsGood
        ? trend === "up"
        : trend === "down";

  if (trend === "neutral") {
    return <Minus size={size} className={clsx("text-dash-muted", className)} />;
  }

  const colorClass = isGood ? "text-emerald-400" : "text-red-700";

  if (trend === "up") {
    return (
      <TrendingUp
        size={size}
        className={clsx(colorClass, className)}
        aria-label="Aufwärtstrend"
      />
    );
  }
  return (
    <TrendingDown
      size={size}
      className={clsx(colorClass, className)}
      aria-label="Abwärtstrend"
    />
  );
}

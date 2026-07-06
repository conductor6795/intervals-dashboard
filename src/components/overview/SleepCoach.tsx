"use client";
import { Moon, Sunrise, BedDouble, AlarmClock, Info, Sparkles, Repeat } from "lucide-react";
import { clsx } from "clsx";
import { SleepCoachPlan, formatLocalIsoTime } from "@/lib/sleepCoach";

function TimeBlock({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-1 flex-1">
      <Icon size={16} className={color} />
      <span className={clsx("text-lg font-bold tabular-nums", color)}>{value}</span>
      <span className="text-[10px] text-dash-muted uppercase tracking-wider">{label}</span>
    </div>
  );
}

function consistencyColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export default function SleepCoach({ plan }: { plan: SleepCoachPlan }) {
  const lastStart = formatLocalIsoTime(plan.lastNight?.sleepStart ?? null);
  const lastEnd = formatLocalIsoTime(plan.lastNight?.sleepEnd ?? null);
  const needH = Math.floor(plan.totalNeedH);
  const needMin = Math.round((plan.totalNeedH - needH) * 60);

  return (
    <div className="bg-dash-card border border-dash-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">Schlafcoach</p>
        <span className="text-[11px] text-dash-muted">
          Bedarf heute: <span className="text-white font-semibold tabular-nums">{needH}h {needMin > 0 ? `${needMin}min` : ""}</span>
        </span>
      </div>

      {/* Gelernt-Badge / Datenlage */}
      {plan.isLearned ? (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
          <Sparkles size={13} className="text-indigo-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-indigo-300/90 leading-snug">
            Optimalbedarf aus deinen Daten gelernt: <span className="font-semibold">~{plan.baseNeedH.toFixed(1)} h</span> lieferten die besten Erholungswerte.
          </p>
        </div>
      ) : !plan.hasEnoughData ? (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <Info size={13} className="text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-yellow-300/90 leading-snug">
            Noch wenig Schlaf-Historie — sobald ~10 Nächte vorliegen, lernt der Coach deinen persönlichen Optimalbedarf.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-dash-bg border border-dash-border">
          <Info size={13} className="text-dash-muted mt-0.5 shrink-0" />
          <p className="text-[11px] text-dash-muted leading-snug">
            Basiswert {plan.baseNeedH.toFixed(1)} h aus den Einstellungen — der Coach lernt deinen Optimalbedarf mit mehr Nächten.
          </p>
        </div>
      )}

      {/* Empfehlung für heute Nacht */}
      <div className="flex items-stretch gap-2 bg-dash-bg rounded-xl p-3">
        <TimeBlock icon={BedDouble} label="Licht aus" value={plan.lightsOutTime} color="text-indigo-400" />
        <div className="w-px bg-dash-border" />
        <TimeBlock icon={Moon} label="Einschlafen bis" value={plan.sleepByTime} color="text-blue-400" />
        <div className="w-px bg-dash-border" />
        <TimeBlock icon={Sunrise} label={plan.wakeIsWeekday ? "Aufstehen (Wo)" : "Aufstehen (WE)"} value={plan.wakeTime} color="text-orange-400" />
      </div>

      {/* Regelmäßigkeit + beste Bettzeit */}
      {(plan.consistencyScore != null || plan.bestBedtime) && (
        <div className="flex items-center gap-4 flex-wrap">
          {plan.consistencyScore != null && (
            <div className="flex items-center gap-1.5">
              <Repeat size={12} className="text-dash-muted" />
              <span className="text-[11px] text-dash-muted">Regelmäßigkeit:</span>
              <span className={clsx("text-[11px] font-semibold tabular-nums", consistencyColor(plan.consistencyScore))}>
                {plan.consistencyScore} · {plan.consistencyLabel}
              </span>
            </div>
          )}
          {plan.bestBedtime && (
            <div className="flex items-center gap-1.5">
              <Moon size={12} className="text-dash-muted" />
              <span className="text-[11px] text-dash-muted">Beste Nächte ab:</span>
              <span className="text-[11px] font-semibold text-white tabular-nums">{plan.bestBedtime}</span>
            </div>
          )}
        </div>
      )}

      {/* Begründung */}
      <div>
        <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium mb-1.5">Warum</p>
        <ul className="space-y-1">
          {plan.reasoning.map((r, i) => (
            <li key={i} className="text-[11px] text-dash-muted leading-snug flex gap-1.5">
              <span className="text-dash-muted/50">•</span>{r}
            </li>
          ))}
        </ul>
      </div>

      {/* Letzte Nacht */}
      {(lastStart || lastEnd || plan.lastNight?.durationH != null) && (
        <div className="pt-3 border-t border-dash-border flex items-center justify-between text-[11px]">
          <span className="text-dash-muted">Letzte Nacht</span>
          <span className="text-white tabular-nums flex items-center gap-2">
            {lastStart && <span title="Eingeschlafen">🌙 {lastStart}</span>}
            {lastEnd && <span title="Aufgewacht">☀️ {lastEnd}</span>}
            {plan.lastNight?.durationH != null && (
              <span className={clsx(!lastStart && !lastEnd ? "text-white" : "text-dash-muted")}>
                {plan.lastNight.durationH.toFixed(1)}h
              </span>
            )}
          </span>
        </div>
      )}

      {/* Nickerchen */}
      {plan.todayNaps.length > 0 && (
        <div className="pt-3 border-t border-dash-border">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlarmClock size={11} className="text-dash-muted" />
            <p className="text-[10px] text-dash-muted uppercase tracking-wider font-medium">
              Nickerchen heute (erkannt, Näherung)
            </p>
          </div>
          <div className="space-y-1">
            {plan.todayNaps.map((n, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span className="text-dash-muted">Body-Battery-Anstieg tagsüber</span>
                <span className="text-white tabular-nums">~{n.durationMin} min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

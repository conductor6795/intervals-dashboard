"use client";
import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  children: React.ReactNode;   // Popover-Inhalt
  size?: number;
  align?: "left" | "right";
  label?: string;              // a11y-Label
}

/** Kleiner i-Button, der beim Klick ein Popover mit beliebigem Inhalt zeigt. */
export default function InfoPopover({ children, size = 12, align = "right", label = "Info" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center text-dash-muted/70 hover:text-white transition-colors cursor-help"
      >
        <Info size={size} />
      </button>
      {open && (
        <span
          className={clsx(
            "absolute z-50 top-full mt-1.5 w-max max-w-[260px] rounded-xl bg-dash-card border border-dash-border p-3 text-[11px] font-normal normal-case tracking-normal text-dash-muted shadow-xl leading-relaxed",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}

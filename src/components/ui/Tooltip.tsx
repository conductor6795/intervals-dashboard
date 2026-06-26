"use client";
import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";
import { GLOSSARY } from "@/lib/glossary";

interface Props {
  term: string;
  children: React.ReactNode;
}

export default function Tooltip({ term, children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const definition = GLOSSARY[term];

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  if (!definition) return <>{children}</>;

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setOpen((v) => !v); } }}
        className="inline-flex items-center gap-0.5 underline decoration-dotted underline-offset-2 decoration-current/40 text-inherit cursor-help"
      >
        {children}
        <HelpCircle size={10} className="text-dash-muted/60 shrink-0 ml-0.5" />
      </span>
      {open && (
        <span className="absolute z-50 left-0 top-full mt-1.5 w-max max-w-[220px] rounded-xl bg-dash-card border border-dash-border p-2.5 text-xs font-normal normal-case tracking-normal text-dash-muted shadow-lg leading-relaxed">
          {definition}
        </span>
      )}
    </span>
  );
}

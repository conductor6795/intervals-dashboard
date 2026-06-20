"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Generisches Detail-Fenster: dunkler Backdrop + zentrierte (mobil: bottom-sheet)
 * Karte. Schließt per Esc, Backdrop-Klick oder X. Bewusst solide (nicht glasig),
 * damit der Inhalt gut lesbar ist.
 */
export default function DetailModal({ open, onClose, title, subtitle, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto",
          "border border-dash-border rounded-t-2xl sm:rounded-2xl shadow-2xl"
        )}
        style={{ backgroundColor: "#131929" }}
      >
        <div
          className="sticky top-0 z-10 border-b border-dash-border px-5 py-3 flex items-start justify-between gap-3"
          style={{ backgroundColor: "#131929" }}
        >
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            {subtitle && <p className="text-[11px] text-dash-muted mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-dash-muted hover:text-white transition-colors p-1 -mr-1 flex-shrink-0"
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

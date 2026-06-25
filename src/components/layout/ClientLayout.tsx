"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, Zap } from "lucide-react";
import Sidebar from "./Sidebar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Apply stored theme + accent on mount
  useEffect(() => {
    const theme = localStorage.getItem("dash-theme") ?? "navy";
    document.documentElement.setAttribute("data-theme", theme);

    const accent = localStorage.getItem("dash-accent") ?? "indigo";
    const vars: Record<string, Record<string, string>> = {
      indigo:  { "--a-600": "#4f46e5", "--a-500": "#6366f1", "--a-400": "#818cf8", "--a-900": "#1e1b4b", "--a-900-hex": "30 27 75" },
      blue:    { "--a-600": "#2563eb", "--a-500": "#3b82f6", "--a-400": "#60a5fa", "--a-900": "#1e3a5f", "--a-900-hex": "30 58 95" },
      teal:    { "--a-600": "#0d9488", "--a-500": "#14b8a6", "--a-400": "#2dd4bf", "--a-900": "#042f2e", "--a-900-hex": "4 47 46" },
      violet:  { "--a-600": "#7c3aed", "--a-500": "#8b5cf6", "--a-400": "#a78bfa", "--a-900": "#2e1065", "--a-900-hex": "46 16 101" },
      emerald: { "--a-600": "#059669", "--a-500": "#10b981", "--a-400": "#34d399", "--a-900": "#022c22", "--a-900-hex": "2 44 34" },
      rose:    { "--a-600": "#e11d48", "--a-500": "#f43f5e", "--a-400": "#fb7185", "--a-900": "#4c0519", "--a-900-hex": "76 5 25" },
      amber:   { "--a-600": "#d97706", "--a-500": "#f59e0b", "--a-400": "#fcd34d", "--a-900": "#451a03", "--a-900-hex": "69 26 3" },
      orange:  { "--a-600": "#ea580c", "--a-500": "#f97316", "--a-400": "#fb923c", "--a-900": "#431407", "--a-900-hex": "67 20 7" },
    };
    const accentVars = vars[accent] ?? vars["indigo"];
    Object.entries(accentVars).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, v);
    });
  }, []);

  return (
    <>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-10 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:ml-52 h-screen flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden shrink-0 bg-dash-bg/95 backdrop-blur border-b border-dash-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-dash-muted hover:text-white transition-colors p-1"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--a-600)" }}>
              <Zap size={12} className="text-white" fill="white" />
            </div>
            <span className="text-sm font-semibold text-white">Intervals Dashboard</span>
          </div>
        </div>

        {/* Page content – scrollable, fills remaining height */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {children}
        </div>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Intervals Dashboard",
  description: "Persönliches Ausdauerathlet-Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

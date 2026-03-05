import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DatOps Agent SDK — Live Demo",
  description: "See trust-gated AI agent execution in your browser. Drag the trust slider and watch tools get blocked in real-time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

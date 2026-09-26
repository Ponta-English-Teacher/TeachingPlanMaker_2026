import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Teaching Plan Maker",
  description: "A thoughtful workspace for teaching.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

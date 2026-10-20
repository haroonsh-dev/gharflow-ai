import { t } from "@/lib/copy";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: t("GharFlow AI · Household Utility & Telecom Forensics"),
  description:
    "Autonomous utility forensics for Pakistani households. Audit LESCO, K-Electric, MEPCO & PTCL bills, detect 30-day pro-rata slab breaches, verify taxes, and export NEPRA & PTA dispute dossiers.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

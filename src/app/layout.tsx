import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GharFlow AI · Household energy clarity",
  description: "Review LESCO bills, track usage and keep evidence in one private place.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

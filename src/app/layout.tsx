import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opmaint — Permit to Work",
  description: "Permit to Work module for the Opmaint CMMS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gridline Stealth — Autocross Run Comparison",
  description:
    "Compare autocross runs side by side. Stealth edition — minimal, precise, no distractions.",
  keywords: ["autocross", "comparison", "video", "racing", "analysis", "motorsports"],
  openGraph: {
    title: "Gridline Stealth — Autocross Run Comparison",
    description: "Compare autocross runs side by side. Stealth edition.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head />
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

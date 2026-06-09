import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RaceCompare — Autocross Run Analysis",
  description:
    "Compare autocross runs side by side with synchronized video playback, launch-point syncing, and run markers.",
  keywords: ["autocross", "comparison", "video", "racing", "analysis", "motorsports"],
  openGraph: {
    title: "RaceCompare — Autocross Run Analysis",
    description: "Compare autocross runs side by side with synchronized video playback.",
    type: "website",
    url: "https://racecompare.app",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0e0f11",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}

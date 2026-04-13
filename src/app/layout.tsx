import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gridline Nitro — Autocross Run Comparison",
  description:
    "Compare autocross runs side by side with synchronized video playback, timing analysis, and annotations.",
  keywords: ["autocross", "comparison", "video", "racing", "analysis", "motorsports"],
  openGraph: {
    title: "Gridline Nitro — Autocross Run Comparison",
    description: "Compare autocross runs side by side with synchronized video playback.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#030308",
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
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Orbitron:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh flex flex-col bg-background text-foreground">
        {/* Scan line overlay */}
        <div className="scan-lines" />
        {/* Animated racing stripe */}
        <div className="racing-stripe" />
        {children}
      </body>
    </html>
  );
}

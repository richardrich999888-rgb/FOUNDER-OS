import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Twin — Your personal space",
  description: "Your personal context, memories and tasks. A private personal-agent prototype.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

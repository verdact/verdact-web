import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdact",
  description: "Chargeback dispute management for Stripe merchants.",
  icons: {
    icon: [
      { url: "/favicon.svg?v=20260524dark", type: "image/svg+xml" },
      { url: "/favicon.ico?v=20260524dark", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico?v=20260524dark",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

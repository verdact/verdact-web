import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Verdact",
    template: "%s | Verdact",
  },
  description:
    "Dispute-ready evidence records for Stripe merchants. Build bulletproof chargebacks before they arrive.",
  icons: {
    icon: [{ url: "/favicon.svg?v=20260612verdact-gap", type: "image/svg+xml" }],
    shortcut: "/favicon.svg?v=20260612verdact-gap",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${schibsted.variable}`}>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

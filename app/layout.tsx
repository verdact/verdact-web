import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Display: Fraunces variable serif for headings (matches approved wireframes).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

// Body: Inter variable sans for all running text.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Metadata / labels: IBM Plex Mono for ALL-CAPS eyebrows and record fields.
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Verdact",
    template: "%s | Verdact",
  },
  description: "Dispute-ready evidence records for Stripe merchants.",
  icons: {
    icon: [
      { url: "/favicon.svg?v=20260527record", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg?v=20260527record",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full antialiased ${fraunces.variable} ${inter.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            // FOUC guard: apply an explicit stored preference before paint.
            // No stored value -> no data-theme attribute -> CSS follows the
            // system prefers-color-scheme. Default is therefore "system".
            __html: `try{var t=localStorage.getItem('verdact-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.removeAttribute('data-theme');}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}

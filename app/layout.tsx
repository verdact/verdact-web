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
    icon: [{ url: "/favicon.svg?v=20260612verdact-white", type: "image/svg+xml" }],
    shortcut: "/favicon.svg?v=20260612verdact-white",
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
      className={`h-full antialiased ${schibsted.variable}`}
    >
      <body className="min-h-full flex flex-col">
        {/* Resolve the app theme before first paint — prevents FOUC and makes
            system-dark deterministic. An explicit Light/Dark choice wins; with
            no stored choice we follow the OS via matchMedia and set the
            attribute so .app-shell renders dark on first load for system-dark
            users. Marketing/auth stay light because dark tokens are scoped to
            .app-shell in globals.css. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('verdact-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`,
          }}
        />
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@studio/ui";

export const metadata: Metadata = {
  title: "COG App",
  description: "Church Operations and Governance App",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

import Script from "next/script";
import { AuthSync } from "./auth-sync";
import { ReactQueryProvider } from "@/providers/react-query-provider";
import { CookieConsentBanner } from "@/components/common/cookie-consent-banner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-body antialiased">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('cog_app_theme') || localStorage.getItem('theme');
                  var isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                    document.documentElement.dataset.theme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                    document.documentElement.dataset.theme = 'light';
                  }

                  var s = localStorage.getItem('cog_app_font_scale') || localStorage.getItem('app_font_scale');
                  if (s) {
                    var parsed = parseFloat(s);
                    if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 1.6) {
                      document.documentElement.style.setProperty('--font-scale', parsed.toString());
                      document.documentElement.dataset.fontScale = parsed.toString();
                    }
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <ReactQueryProvider>
          <AuthSync>
            {children}
            <Toaster />
            <CookieConsentBanner />
          </AuthSync>
        </ReactQueryProvider>
      </body>
    </html>
  );
}

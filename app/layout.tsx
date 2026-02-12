import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Brand Infinity",
  description: "AI-Powered Marketing Content Automation Platform",
};

import { cookies } from 'next/headers';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read theme cookie server-side (if present) to render matching <html> attributes
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme')?.value ?? null;

  return (
    <html lang="en" className={themeCookie ?? undefined} style={themeCookie ? { colorScheme: themeCookie === 'dark' ? 'dark' : 'light' } : undefined}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function() {
          try {
            // If server already set a theme class, do nothing and preserve it
            var docEl = document.documentElement;
            if (docEl.classList.contains('dark') || docEl.classList.contains('light')) return;

            // Prefer cookie if present (keeps server/client in sync)
            var cookieMatch = document.cookie.match(/(^|;)\s*theme=([^;]+)/);
            var theme = cookieMatch ? cookieMatch[2] : (function() { try { return localStorage.getItem('theme'); } catch (e) { return null; }})();

            if (theme) {
              docEl.classList.add(theme);
              docEl.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
            } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
              docEl.classList.add('dark');
              docEl.style.colorScheme = 'dark';
            } else {
              docEl.classList.add('light');
              docEl.style.colorScheme = 'light';
            }
          } catch (e) {}
        })();` }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers initialTheme={themeCookie ?? undefined}>
          {children}
        </Providers>
      </body>
    </html>
  );
}

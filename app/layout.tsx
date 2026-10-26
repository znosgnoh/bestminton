import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
// Self-hosted via @fontsource — avoids flaky next/font/google builds when Google
// returns extensionless /l/font?kit=…&skey=… URLs (vercel/next.js#99114).
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/600.css";
import "@fontsource/caveat/700.css";
import AppHeader from "@/components/layout/AppHeader";
import NavigationProgress from "@/components/layout/NavigationProgress";
import PullToRefresh from "@/components/PullToRefresh";
import PwaRegister from "@/components/PwaRegister";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { isLocale, LOCALE_STORAGE_KEY } from "@/lib/i18n";
import { isTheme, THEME_COOKIE_KEY, THEME_STORAGE_KEY } from "@/lib/theme";
import { SITE_SHORT, SITE_TITLE } from "./layout.constants";
import "./globals.css";

export const preferredRegion = "sin1";

export { SITE_SHORT, SITE_TITLE };

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: "Manage badminton sessions and split court fees with your team",
  applicationName: SITE_SHORT,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_SHORT,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f8" },
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get(LOCALE_STORAGE_KEY)?.value;
  const initialLocale = storedLocale && isLocale(storedLocale) ? storedLocale : "en";
  const storedTheme = cookieStore.get(THEME_COOKIE_KEY)?.value;
  const isDark = isTheme(storedTheme) ? storedTheme === "dark" : false;

  const htmlClass = ["h-full", "antialiased", isDark ? "dark" : ""].filter(Boolean).join(" ");

  return (
    <html
      lang={initialLocale === "zh" ? "zh-CN" : initialLocale}
      className={htmlClass}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var c=${JSON.stringify(THEME_COOKIE_KEY)};var t=localStorage.getItem(k);var dark=t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);document.cookie=c+'='+(dark?'dark':'light')+';path=/;max-age=31536000;SameSite=Lax';}catch(e){}})()`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('${LOCALE_STORAGE_KEY}');if(l==='vi')document.documentElement.lang='vi';else if(l==='zh')document.documentElement.lang='zh-CN';else if(l==='en')document.documentElement.lang='en';}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex min-w-0 flex-col overflow-x-clip">
        <LocaleProvider initialLocale={initialLocale}>
          <NavigationProgress />
          <AppHeader />
          <main className="flex-1 min-w-0">
            <PullToRefresh>{children}</PullToRefresh>
          </main>
          <PwaRegister />
        </LocaleProvider>
      </body>
    </html>
  );
}

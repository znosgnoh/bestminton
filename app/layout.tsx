import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Be_Vietnam_Pro, Noto_Sans } from "next/font/google";
import BadmintonRacketIcon from "@/components/ui/BadmintonRacketIcon";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import PullToRefresh from "@/components/PullToRefresh";
import PwaRegister from "@/components/PwaRegister";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

export const SITE_TITLE = "Bestminton — Split the Court Fee";
export const SITE_SHORT = "Bestminton";

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
    { media: "(prefers-color-scheme: light)", color: "#dc2626" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1612" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${beVietnamPro.variable} ${notoSans.variable}`} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex min-w-0 flex-col overflow-x-clip">
        <header className="tet-header">
          <div className="mx-auto max-w-lg px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="tet-brand min-w-0">
                <BadmintonRacketIcon size={22} className="shrink-0 text-emerald-600 dark:text-amber-400" />
                <span className="font-heading truncate text-lg font-bold leading-tight tracking-tight">{SITE_SHORT}</span>
              </Link>
              <DarkModeToggle />
            </div>
            <nav
              className="tet-nav-scroll mt-2.5 flex items-center gap-3 overflow-x-auto pb-0.5 text-xs font-medium sm:gap-4 sm:text-sm"
              aria-label="Main navigation"
            >
              <Link href="/" className="shrink-0 text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-amber-400">
                Matches
              </Link>
              <Link href="/challenges" className="shrink-0 text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-amber-400">
                Challenges
              </Link>
              <Link href="/leaderboard" className="shrink-0 text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-amber-400">
                Leaderboard
              </Link>
              <Link
                href="/cam"
                className="inline-flex shrink-0 items-center gap-1 text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-amber-400"
              >
                <OrangeJuiceIcon size={14} className="text-orange-500 dark:text-orange-400" />
                <span>Nước cam</span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 min-w-0">
          <PullToRefresh>{children}</PullToRefresh>
        </main>
        <PwaRegister />
      </body>
    </html>
  );
}

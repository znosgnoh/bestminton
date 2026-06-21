import type { Metadata } from "next";
import Link from "next/link";
import { Be_Vietnam_Pro, Noto_Sans } from "next/font/google";
import BadmintonRacketIcon from "@/components/ui/BadmintonRacketIcon";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
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
      <body className="min-h-full flex flex-col">
        <header className="tet-header">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
            <Link href="/" className="tet-brand">
              <BadmintonRacketIcon size={22} className="text-emerald-600 dark:text-amber-400" />
              <span className="font-heading text-lg font-bold leading-tight tracking-tight">{SITE_SHORT}</span>
            </Link>
            <DarkModeToggle />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

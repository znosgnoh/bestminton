import type { Metadata } from "next";
import Link from "next/link";
import ShuttlecockIcon from "@/components/ui/ShuttlecockIcon";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import "./globals.css";

export const SITE_TITLE = "Bestminton - Shuttle Happens — Split the Court Fee";
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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-950 font-sans transition-colors">
        <header className="sticky top-0 z-40 border-b border-amber-200/60 dark:border-amber-900/40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-900 dark:text-gray-100 hover:text-emerald-700 dark:hover:text-emerald-400"
            >
              <ShuttlecockIcon size={22} className="text-emerald-600 dark:text-amber-400" />
              <span className="text-lg font-bold leading-tight">{SITE_SHORT}</span>
            </Link>
            <DarkModeToggle />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}

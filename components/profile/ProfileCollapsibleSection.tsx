"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ProfileCollapsibleSectionProps {
  title: string;
  count?: number;
  children: ReactNode;
  /** Extra line under the title when expanded (e.g. ability subtitle). */
  subtitle?: string;
  defaultOpen?: boolean;
}

export default function ProfileCollapsibleSection({
  title,
  count,
  children,
  subtitle,
  defaultOpen = false,
}: ProfileCollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="tet-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-amber-50/50 dark:hover:bg-gray-900/50"
      >
        <span className="flex min-w-0 items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
          {open ? (
            <ChevronDown size={16} className="shrink-0 text-gray-500" />
          ) : (
            <ChevronRight size={16} className="shrink-0 text-gray-500" />
          )}
          <span className="tet-section-title truncate">{title}</span>
        </span>
        {count != null && (
          <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{count}</span>
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-amber-100/60 px-4 py-3 dark:border-gray-800">
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
          {children}
        </div>
      )}
    </section>
  );
}

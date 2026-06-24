"use client";

import { CheckCircle, Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { MemberDTO } from "@/lib/types";

interface AvatarTileProps {
  member: MemberDTO;
  registered: boolean;
  playedFull?: boolean;
  pending?: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export default function AvatarTile({
  member,
  registered,
  playedFull,
  pending = false,
  disabled,
  onToggle,
}: AvatarTileProps) {
  const isDisabled = disabled || pending;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        if (!isDisabled) onToggle();
      }}
      disabled={isDisabled}
      aria-busy={pending}
      className={`relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition-colors duration-200 ${
        isDisabled && !pending
          ? "cursor-default opacity-50"
          : pending
          ? "cursor-wait opacity-80"
          : "cursor-pointer hover:bg-amber-50/80 dark:hover:bg-gray-800 active:bg-amber-100/60 dark:active:bg-gray-700"
      }`}
    >
      <div className="relative">
        <div
          className={`rounded-full ${
            registered
              ? "ring-2 ring-emerald-600 ring-offset-2 dark:ring-amber-400 dark:ring-offset-gray-950"
              : "ring-2 ring-transparent ring-offset-2"
          }`}
        >
          <Avatar name={member.name} avatarUrl={member.avatarUrl} size="lg" />
        </div>
        {pending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60 dark:bg-gray-950/60">
            <Loader2 size={20} className="animate-spin text-emerald-600 dark:text-amber-400" />
          </div>
        )}
        {registered && !pending && (
          <CheckCircle
            size={18}
            className="absolute -bottom-1 -right-1 rounded-full bg-white dark:bg-gray-950 text-emerald-600 dark:text-amber-400"
            aria-label="Registered"
          />
        )}
        {registered && playedFull === false && (
          <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white leading-none">
            ½
          </span>
        )}
      </div>
      <span
        className={`max-w-18 truncate text-center text-xs font-medium ${
          registered ? "text-emerald-700 dark:text-amber-400" : "text-gray-600 dark:text-gray-400"
        }`}
      >
        {member.name}
      </span>
    </button>
  );
}

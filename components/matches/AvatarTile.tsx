"use client";

import { CheckCircle } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import type { MemberDTO } from "@/lib/types";

interface AvatarTileProps {
  member: MemberDTO;
  registered: boolean;
  playedFull?: boolean;
  disabled: boolean;
  onToggle: () => void;
}

export default function AvatarTile({ member, registered, playedFull, disabled, onToggle }: AvatarTileProps) {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 rounded-xl p-2 transition ${
        disabled
          ? "cursor-default opacity-50"
          : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700"
      }`}
    >
      <div className="relative">
        <div
          className={`rounded-full ${
            registered
              ? "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-gray-950"
              : "ring-2 ring-transparent ring-offset-2"
          }`}
        >
          <Avatar name={member.name} avatarUrl={member.avatarUrl} size="lg" />
        </div>
        {registered && (
          <CheckCircle
            size={18}
            className="absolute -bottom-1 -right-1 rounded-full bg-white dark:bg-gray-950 text-emerald-500"
            aria-label="Registered"
          />
        )}
        {registered && playedFull === false && (
          <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white leading-none">
            ½
          </span>
        )}
      </div>
      <span
        className={`max-w-18 truncate text-center text-xs font-medium ${
          registered ? "text-emerald-700 dark:text-emerald-400" : "text-gray-600 dark:text-gray-400"
        }`}
      >
        {member.name}
      </span>
    </button>
  );
}

"use client";

import { useState, useEffect } from "react";
import { UserPlus, ChevronDown, ChevronUp } from "lucide-react";
import MemberCard from "./MemberCard";
import MemberForm from "./MemberForm";
import * as dataService from "@/lib/dataService";
import type { MemberDTO } from "@/lib/types";

interface MembersSectionProps {
  initialMembers: MemberDTO[];
  dbAvailable: boolean;
}

export default function MembersSection({ initialMembers, dbAvailable }: MembersSectionProps) {
  const [members, setMembers] = useState<MemberDTO[]>(initialMembers);

  useEffect(() => {
    if (!dbAvailable) {
      dataService.getMembers().then(setMembers);
    }
  }, [dbAvailable]);
  const [showForm, setShowForm] = useState(false);

  function handleSaved(m: MemberDTO) {
    setMembers((prev) => {
      const exists = prev.find((x) => x.id === m.id);
      return exists ? prev.map((x) => (x.id === m.id ? m : x)) : [...prev, m];
    });
    setShowForm(false);
  }

  function handleDeleted(id: number) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Members ({members.length})
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 active:bg-emerald-800"
        >
          <UserPlus size={15} />
          {showForm ? (
            <>
              Cancel <ChevronUp size={13} />
            </>
          ) : (
            <>
              Add <ChevronDown size={13} />
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-2xl border border-emerald-100 dark:border-emerald-900 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <MemberForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No members yet. Add the first one above.
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <MemberCard
              key={m.id}
              member={m}
              onUpdated={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </section>
  );
}

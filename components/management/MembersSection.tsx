"use client";

import { useState, useEffect } from "react";
import { UserPlus, ChevronDown, ChevronUp, Download, Loader2, Info } from "lucide-react";
import MemberCard from "./MemberCard";
import MemberForm from "./MemberForm";
import * as dataService from "@/lib/dataService";
import type { MemberDTO, SplitwiseMember } from "@/lib/types";

interface MembersSectionProps {
  initialMembers: MemberDTO[];
  dbAvailable: boolean;
  splitwiseConfigured: boolean;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export default function MembersSection({
  initialMembers,
  dbAvailable,
  splitwiseConfigured,
}: MembersSectionProps) {
  const [members, setMembers] = useState<MemberDTO[]>(initialMembers);
  const [listExpanded, setListExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!dbAvailable) {
      dataService.getMembers().then(setMembers);
    }
  }, [dbAvailable]);

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

  async function handleImportFromSplitwise() {
    setImporting(true);
    setImportError(null);
    setImportMessage(null);

    try {
      const res = await fetch("/api/splitwise/members");
      const data = (await res.json()) as {
        members?: SplitwiseMember[];
        group?: { id: number; name: string } | null;
        error?: string;
      };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to load Splitwise members.");
      }

      const splitwiseMembers = data.members ?? [];
      if (splitwiseMembers.length === 0) {
        setImportMessage("No members found in your Splitwise group.");
        return;
      }

      let created = 0;
      let updated = 0;
      const nextMembers = [...members];

      for (const sw of splitwiseMembers) {
        const displayName =
          sw.displayName ??
          [sw.first_name, sw.last_name].filter(Boolean).join(" ").trim();
        const avatarUrl = sw.picture?.medium || sw.picture?.large || null;

        const bySplitwiseId = nextMembers.find((m) => m.splitwiseId === sw.id);
        if (bySplitwiseId) {
          const saved = await dataService.updateMember(bySplitwiseId.id, {
            name: displayName,
            avatarUrl,
            splitwiseId: sw.id,
          });
          const idx = nextMembers.findIndex((m) => m.id === bySplitwiseId.id);
          if (idx >= 0) nextMembers[idx] = saved;
          updated++;
          continue;
        }

        const byName = nextMembers.find(
          (m) => !m.splitwiseId && normalizeName(m.name) === normalizeName(displayName)
        );
        if (byName) {
          const saved = await dataService.updateMember(byName.id, {
            name: displayName,
            avatarUrl: byName.avatarUrl ?? avatarUrl,
            splitwiseId: sw.id,
          });
          const idx = nextMembers.findIndex((m) => m.id === byName.id);
          if (idx >= 0) nextMembers[idx] = saved;
          updated++;
          continue;
        }

        const saved = await dataService.createMember({
          name: displayName,
          avatarUrl,
          splitwiseId: sw.id,
        });
        nextMembers.push(saved);
        created++;
      }

      nextMembers.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(nextMembers);

      const groupLabel = data.group?.name ? ` from "${data.group.name}"` : "";
      setImportMessage(
        `Imported${groupLabel}: ${created} added, ${updated} updated (${splitwiseMembers.length} total).`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setListExpanded((v) => !v)}
          aria-expanded={listExpanded}
          aria-controls="members-section-content"
          className="flex items-center gap-1.5 rounded-lg -ml-1 px-1 py-0.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronDown
            size={18}
            className={`shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
              listExpanded ? "" : "-rotate-90"
            }`}
            aria-hidden
          />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Members ({members.length})
          </h2>
        </button>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => {
              const next = !v;
              if (next) setListExpanded(true);
              return next;
            });
          }}
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

      <div
        id="members-section-content"
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          listExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!listExpanded}
      >
        <div className="overflow-hidden">
      {splitwiseConfigured ? (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleImportFromSplitwise}
            disabled={importing || !dbAvailable}
            className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {importing ? "Loading from Splitwise…" : "Load from Splitwise"}
          </button>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <Info size={15} className="mt-0.5 shrink-0" />
          Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to enable member import and expense sync.
        </div>
      )}

      {importError && (
        <p className="mb-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-700 dark:text-red-300">
          {importError}
        </p>
      )}
      {importMessage && (
        <p className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {importMessage}
        </p>
      )}

      {showForm && (
        <div className="mb-4 rounded-2xl border border-emerald-100 dark:border-emerald-900 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <MemberForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {members.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
          No members yet. Add the first one above or load from Splitwise.
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
        </div>
      </div>
    </section>
  );
}

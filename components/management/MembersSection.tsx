"use client";

import { useState, useEffect } from "react";
import { UserPlus, ChevronDown, ChevronUp, Download, Loader2, Info, RotateCcw } from "lucide-react";
import MemberCard from "./MemberCard";
import MemberForm from "./MemberForm";
import AdminPinModal from "@/components/ui/AdminPinModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAdminPin } from "@/hooks/useAdminPin";
import { adminPinHeaders } from "@/lib/adminPinClient";
import * as dataService from "@/lib/dataService";
import { DEFAULT_ELO } from "@/lib/elo";
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const { unlocked, pinRequired, unlock, getStoredPin } = useAdminPin();

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
      const res = await fetch("/api/splitwise/members", {
        headers: adminPinHeaders(),
      });
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

  async function runResetElo(pin?: string) {
    setResetting(true);
    setResetError(null);
    setResetMessage(null);

    try {
      const { count } = await dataService.resetAllElo(pin);
      const refreshed = await dataService.getMembers();
      setMembers(refreshed);
      setResetMessage(
        `Reset Elo to ${DEFAULT_ELO} for ${count} member${count === 1 ? "" : "s"}.`
      );
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  }

  function handleResetEloConfirm() {
    setShowResetConfirm(false);
    if (pinRequired && !unlocked) {
      setShowPinModal(true);
    } else {
      void runResetElo(pinRequired ? getStoredPin() : undefined);
    }
  }

  async function handlePinSubmit(pin: string) {
    const err = await unlock(pin);
    if (err) return err;
    setShowPinModal(false);
    void runResetElo(pin);
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setListExpanded((v) => !v)}
          aria-expanded={listExpanded}
          aria-controls="members-section-content"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg -ml-1 px-1 py-0.5 text-left transition-colors duration-200 hover:bg-amber-50 dark:hover:bg-gray-800"
        >
          <ChevronDown
            size={18}
            className={`shrink-0 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
              listExpanded ? "" : "-rotate-90"
            }`}
            aria-hidden
          />
          <h2 className="tet-section-title">
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
          className="tet-btn-primary"
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
            className="tet-btn-ghost border border-gray-200 dark:border-gray-700 bg-white/85 dark:bg-gray-900/85 px-3 py-2.5 disabled:opacity-60"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {importing ? "Loading from Splitwise…" : "Load from Splitwise"}
          </button>
        </div>
      ) : (
        <div className="mb-4 tet-alert-info">
          <Info size={15} className="mt-0.5 shrink-0" />
          Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to enable member import and expense sync.
        </div>
      )}

      {importError && (
        <p className="mb-4 tet-alert-error">
          {importError}
        </p>
      )}
      {importMessage && (
        <p className="mb-4 tet-alert-success">
          {importMessage}
        </p>
      )}

      {dbAvailable && members.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            disabled={resetting}
            className="tet-btn-ghost border border-red-200 dark:border-red-900/50 bg-white/85 dark:bg-gray-900/85 px-3 py-2.5 text-red-600 dark:text-red-400 disabled:opacity-60"
          >
            {resetting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RotateCcw size={15} />
            )}
            {resetting ? "Resetting Elo…" : `Reset all Elo to ${DEFAULT_ELO}`}
          </button>
        </div>
      )}

      {resetError && (
        <p className="mb-4 tet-alert-error">{resetError}</p>
      )}
      {resetMessage && (
        <p className="mb-4 tet-alert-success">{resetMessage}</p>
      )}

      {showForm && (
        <div className="mb-4 tet-panel">
          <MemberForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {members.length === 0 ? (
        <p className="tet-empty">
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

      <ConfirmDialog
        open={showResetConfirm}
        title={`Reset all Elo to ${DEFAULT_ELO}?`}
        message={`Every member's Elo rating will be set to ${DEFAULT_ELO}. Win/loss records (total matches and wins) are not changed.`}
        confirmLabel="Reset Elo"
        onConfirm={handleResetEloConfirm}
        onCancel={() => setShowResetConfirm(false)}
      />

      <AdminPinModal
        open={showPinModal}
        title="Confirm Elo reset"
        onSubmit={handlePinSubmit}
        onCancel={() => setShowPinModal(false)}
      />
    </section>
  );
}

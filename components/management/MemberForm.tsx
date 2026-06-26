"use client";

import { useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import AdminPinModal from "@/components/ui/AdminPinModal";
import { useAdminPin } from "@/hooks/useAdminPin";
import { adminPinHeaders } from "@/lib/adminPinClient";
import * as dataService from "@/lib/dataService";
import { DEFAULT_ELO } from "@/lib/elo";
import type { MemberDTO } from "@/lib/types";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_BYTES = 2 * 1024 * 1024;

interface MemberFormProps {
  initial?: MemberDTO;
  onSaved: (m: MemberDTO) => void;
  onCancel?: () => void;
}

function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Only JPG and PNG images are allowed.";
  }
  if (file.size > MAX_BYTES) {
    return "Image must be 2MB or smaller.";
  }
  return null;
}

export default function MemberForm({ initial, onSaved, onCancel }: MemberFormProps) {
  const { unlocked, pinRequired, unlock, getStoredPin } = useAdminPin();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl ?? "");
  const [splitwiseIdStr, setSplitiwseIdStr] = useState(
    initial?.splitwiseId?.toString() ?? ""
  );
  const [eloRatingStr, setEloRatingStr] = useState(
    initial?.eloRating?.toString() ?? String(DEFAULT_ELO)
  );
  const [totalMatchesStr, setTotalMatchesStr] = useState(initial?.totalMatches?.toString() ?? "0");
  const [totalWinsStr, setTotalWinsStr] = useState(initial?.totalWins?.toString() ?? "0");
  const [showStats, setShowStats] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<Parameters<typeof dataService.updateMember>[1] | null>(null);

  async function uploadAvatarFile(file: File) {
    const validationError = validateAvatarFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        headers: adminPinHeaders(),
        body: formData,
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      setAvatarUrl(data.url ?? "");
    } catch (err) {
      setPreviewUrl(null);
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void uploadAvatarFile(file);
    }
  }

  function clearAvatar() {
    setAvatarUrl("");
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function statsChanged(): boolean {
    if (!initial) return false;
    const eloRating = Number(eloRatingStr);
    const totalMatches = Number(totalMatchesStr);
    const totalWins = Number(totalWinsStr);
    return (
      eloRating !== initial.eloRating ||
      totalMatches !== initial.totalMatches ||
      totalWins !== initial.totalWins
    );
  }

  async function saveMember(payload: Parameters<typeof dataService.updateMember>[1]) {
    setSaving(true);
    setError(null);
    try {
      const saved = initial
        ? await dataService.updateMember(initial.id, payload)
        : await dataService.createMember(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
      setPendingPayload(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const splitwiseId = splitwiseIdStr ? Number(splitwiseIdStr) : null;
    if (splitwiseIdStr && (!Number.isInteger(splitwiseId) || splitwiseId! <= 0)) {
      setError("Splitwise ID must be a positive integer.");
      return;
    }
    if (uploading) {
      setError("Please wait for the avatar upload to finish.");
      return;
    }

    const payload: Parameters<typeof dataService.updateMember>[1] = {
      name: name.trim(),
      avatarUrl: avatarUrl.trim() || null,
      splitwiseId: splitwiseId ?? null,
    };

    if (initial && (showStats || statsChanged())) {
      const eloRating = Number(eloRatingStr);
      const totalMatches = Number(totalMatchesStr);
      const totalWins = Number(totalWinsStr);

      if (!Number.isInteger(eloRating) || eloRating < 100 || eloRating > 3000) {
        setError("Elo rating must be an integer between 100 and 3000.");
        return;
      }
      if (!Number.isInteger(totalMatches) || totalMatches < 0) {
        setError("Total matches must be a non-negative integer.");
        return;
      }
      if (!Number.isInteger(totalWins) || totalWins < 0) {
        setError("Total wins must be a non-negative integer.");
        return;
      }
      if (totalWins > totalMatches) {
        setError("Total wins cannot exceed total matches.");
        return;
      }

      if (statsChanged()) {
        payload.eloRating = eloRating;
        payload.totalMatches = totalMatches;
        payload.totalWins = totalWins;

        if (pinRequired && !unlocked) {
          setPendingPayload(payload);
          setShowPinModal(true);
          return;
        }
        if (pinRequired) {
          payload.pin = getStoredPin();
        }
      }
    }

    await saveMember(payload);
  }

  async function handlePinSubmit(pin: string): Promise<string | null> {
    const pinError = await unlock(pin);
    if (pinError) return pinError;
    setShowPinModal(false);
    if (pendingPayload) {
      await saveMember({ ...pendingPayload, pin });
    }
    return null;
  }

  const displayAvatarUrl = previewUrl || avatarUrl || null;
  const busy = saving || uploading;

  const inputCls = "tet-input";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="tet-label">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alice"
          className={inputCls}
        />
      </div>

      <div>
        <label className="tet-label">
          Avatar (optional)
        </label>
        <div className="flex items-center gap-3">
          <Avatar
            name={name.trim() || "?"}
            avatarUrl={displayAvatarUrl}
            size="lg"
            className={uploading ? "opacity-60" : ""}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-xs text-gray-600 dark:text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950 dark:file:text-emerald-300 dark:hover:file:bg-emerald-900 disabled:opacity-60"
            />
            <p className="text-[11px] text-gray-500 dark:text-gray-500">
              JPG or PNG, max 2MB
            </p>
            {displayAvatarUrl && (
              <button
                type="button"
                onClick={clearAvatar}
                disabled={uploading}
                className="inline-flex w-fit items-center gap-1 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 disabled:opacity-60"
              >
                <X size={12} />
                Remove avatar
              </button>
            )}
          </div>
          {uploading && (
            <Loader2 size={18} className="shrink-0 animate-spin text-emerald-600" />
          )}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Or paste image URL
          </summary>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            disabled={uploading}
            className={`${inputCls} mt-2`}
          />
        </details>
      </div>

      <div>
        <label className="tet-label">
          Splitwise ID (optional)
        </label>
        <input
          type="number"
          min="1"
          step="1"
          value={splitwiseIdStr}
          onChange={(e) => setSplitiwseIdStr(e.target.value)}
          placeholder="e.g. 1234567"
          className={inputCls}
        />
      </div>

      {initial && (
        <div>
          <button
            type="button"
            onClick={() => setShowStats((v) => !v)}
            className="text-xs font-medium text-emerald-700 dark:text-amber-400 hover:underline"
          >
            {showStats ? "Hide" : "Edit"} Elo & match stats (admin)
          </button>
          {showStats && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <label className="tet-label text-[11px]">Elo</label>
                <input
                  type="number"
                  min="100"
                  max="3000"
                  step="1"
                  value={eloRatingStr}
                  onChange={(e) => setEloRatingStr(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="tet-label text-[11px]">Matches</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={totalMatchesStr}
                  onChange={(e) => setTotalMatchesStr(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="tet-label text-[11px]">Wins</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={totalWinsStr}
                  onChange={(e) => setTotalWinsStr(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          )}
          {showStats && pinRequired && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-500">
              Changing stats requires captain PIN.
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="tet-alert-error px-3 py-2 text-xs">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="tet-btn-ghost flex-1"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="tet-btn-primary flex-1"
        >
          {(saving || uploading) && <Loader2 size={14} className="animate-spin" />}
          {uploading ? "Uploading…" : saving ? "Saving…" : initial ? "Save Changes" : "Add Member"}
        </button>
      </div>

      <AdminPinModal
        open={showPinModal}
        title="PIN to Edit Stats"
        onSubmit={handlePinSubmit}
        onCancel={() => {
          setShowPinModal(false);
          setPendingPayload(null);
        }}
      />
    </form>
  );
}

"use client";

import { useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import * as dataService from "@/lib/dataService";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl ?? "");
  const [splitwiseIdStr, setSplitiwseIdStr] = useState(
    initial?.splitwiseId?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        avatarUrl: avatarUrl.trim() || null,
        splitwiseId: splitwiseId ?? null,
      };
      const saved = initial
        ? await dataService.updateMember(initial.id, payload)
        : await dataService.createMember(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
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
    </form>
  );
}

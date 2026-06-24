"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface AdminPinModalProps {
  open: boolean;
  title?: string;
  onSubmit: (pin: string) => Promise<string | null>;
  onCancel: () => void;
}

export default function AdminPinModal({
  open,
  title = "Enter Captain PIN",
  onSubmit,
  onCancel,
}: AdminPinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await onSubmit(pin);
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setPin("");
      onCancel();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="tet-card w-full max-w-sm p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="tet-section-title">{title}</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="admin-pin" className="tet-label">
              PIN
            </label>
            <input
              id="admin-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="tet-input-lg mt-1 w-full"
              placeholder="••••"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="tet-btn-ghost flex-1" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="tet-btn-primary flex-1" disabled={submitting || !pin}>
              {submitting ? <Loader2 size={18} className="mx-auto animate-spin" /> : "Confirm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

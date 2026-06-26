"use client";

import { useRouter } from "next/navigation";
import AdminPinModal from "@/components/ui/AdminPinModal";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useAdminPin } from "@/hooks/useAdminPin";

interface ManagementGateProps {
  children: React.ReactNode;
}

export default function ManagementGate({ children }: ManagementGateProps) {
  const router = useRouter();
  const { unlocked, pinRequired, checking, unlock } = useAdminPin();

  if (checking) {
    return (
      <div className="mx-auto flex max-w-lg justify-center px-4 py-16">
        <LoadingSpinner size={28} className="text-emerald-600 dark:text-amber-400" />
      </div>
    );
  }

  if (pinRequired && !unlocked) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 space-y-8">
        <div>
          <h1 className="tet-page-title">Management</h1>
          <p className="mt-1 tet-muted">Enter the captain PIN to manage members, matches, and kèo.</p>
        </div>
        <AdminPinModal
          open
          title="Enter Captain PIN"
          onSubmit={unlock}
          onCancel={() => router.push("/")}
        />
      </div>
    );
  }

  return <>{children}</>;
}

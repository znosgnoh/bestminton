"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ChallengeForm from "@/components/challenges/ChallengeForm";
import type { MemberDTO } from "@/lib/types";

interface NewChallengePageClientProps {
  members: MemberDTO[];
  dbAvailable: boolean;
}

export default function NewChallengePageClient({
  members,
  dbAvailable,
}: NewChallengePageClientProps) {
  const router = useRouter();
  const [createdId, setCreatedId] = useState<number | null>(null);

  if (!dbAvailable) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <Link href="/challenges" className="tet-link">
          <ArrowLeft size={15} />
          All Challenges
        </Link>
        <div className="tet-card p-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Challenges require a live database connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Link href="/challenges" className="tet-link">
        <ArrowLeft size={15} />
        All Challenges
      </Link>

      <h1 className="tet-page-title">New Challenge</h1>

      <div className="tet-card p-5">
        <ChallengeForm
          members={members}
          onCreated={(id) => {
            setCreatedId(id);
            setTimeout(() => router.push(`/challenges/${id}`), 600);
          }}
        />
      </div>

      {createdId && (
        <div className="tet-alert-success text-sm text-center">
          Redirecting to challenge…
        </div>
      )}
    </div>
  );
}

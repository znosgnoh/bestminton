"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import BulkChallengeForm from "@/components/challenges/BulkChallengeForm";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useI18n } from "@/contexts/LocaleContext";
import type { MemberDTO } from "@/lib/types";

interface BulkChallengePageClientProps {
  members: MemberDTO[];
  dbAvailable: boolean;
  dbError?: string;
}

export default function BulkChallengePageClient({
  members,
  dbAvailable,
  dbError,
}: BulkChallengePageClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  if (!dbAvailable) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <Link href="/challenges" className="tet-link">
          <ArrowLeft size={15} />
          {t("challenges.allKeo")}
        </Link>
        <ErrorBanner message={dbError ?? t("challenges.dbRequired")} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Link href="/challenges" className="tet-link">
        <ArrowLeft size={15} />
        {t("challenges.allKeo")}
      </Link>

      <h1 className="tet-page-title">{t("challenges.bulkTitle")}</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t("challenges.bulkIntro")}</p>

      <div className="tet-card p-5">
        <BulkChallengeForm
          members={members}
          onCreated={(count) => {
            setCreatedCount(count);
            setTimeout(() => {
              router.push("/challenges");
              router.refresh();
            }, 700);
          }}
        />
      </div>

      {createdCount !== null && (
        <div className="tet-alert-success text-sm text-center">
          {t("challenges.bulkSuccess", { count: createdCount })}
        </div>
      )}
    </div>
  );
}

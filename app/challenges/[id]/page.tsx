import { Suspense } from "react";
import { ChallengeDetailSkeleton } from "@/components/ui/Skeleton";
import ChallengeDetailLoader from "./ChallengeDetailLoader";

export const dynamic = "force-dynamic";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: challengeIdStr } = await params;

  return (
    <Suspense fallback={<ChallengeDetailSkeleton />}>
      <ChallengeDetailLoader challengeIdStr={challengeIdStr} />
    </Suspense>
  );
}

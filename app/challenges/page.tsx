import { Suspense } from "react";
import { ChallengesListSkeleton } from "@/components/ui/Skeleton";
import ChallengesLoader from "./ChallengesLoader";

export const dynamic = "force-dynamic";

export default function ChallengesPage() {
  return (
    <Suspense fallback={<ChallengesListSkeleton />}>
      <ChallengesLoader />
    </Suspense>
  );
}

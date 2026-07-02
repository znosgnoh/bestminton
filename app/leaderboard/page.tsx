import { Suspense } from "react";
import { LeaderboardSkeleton } from "@/components/ui/Skeleton";
import LeaderboardLoader from "./LeaderboardLoader";

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardLoader />
    </Suspense>
  );
}

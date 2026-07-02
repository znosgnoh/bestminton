import { Suspense } from "react";
import { MatchDetailSkeleton } from "@/components/ui/Skeleton";
import MatchDetailLoader from "./MatchDetailLoader";

export const revalidate = 30;

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ manage?: string }>;
}) {
  const [{ id: matchIdStr }, sp] = await Promise.all([params, searchParams]);

  return (
    <Suspense fallback={<MatchDetailSkeleton />}>
      <MatchDetailLoader matchIdStr={matchIdStr} isManage={sp.manage === "1"} />
    </Suspense>
  );
}

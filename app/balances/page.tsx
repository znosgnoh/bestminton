import { Suspense } from "react";
import { BalancesPageSkeleton } from "@/components/ui/Skeleton";
import BalancesLoader from "./BalancesLoader";

export const dynamic = "force-dynamic";

export default function BalancesPage() {
  return (
    <Suspense fallback={<BalancesPageSkeleton />}>
      <BalancesLoader />
    </Suspense>
  );
}

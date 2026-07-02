import { Suspense } from "react";
import { CamPageSkeleton } from "@/components/ui/Skeleton";
import CamLoader from "./CamLoader";

export const dynamic = "force-dynamic";

export default function CamPage() {
  return (
    <Suspense fallback={<CamPageSkeleton />}>
      <CamLoader />
    </Suspense>
  );
}

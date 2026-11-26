import { Suspense } from "react";
import { VideosPageSkeleton } from "@/components/ui/Skeleton";
import VideosLoader from "./VideosLoader";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export default function VideosPage() {
  return (
    <Suspense fallback={<VideosPageSkeleton />}>
      <VideosLoader />
    </Suspense>
  );
}

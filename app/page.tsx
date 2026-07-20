import { Suspense } from "react";
import { HomePageSkeleton } from "@/components/ui/Skeleton";
import HomeLoader from "./HomeLoader";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomeLoader />
    </Suspense>
  );
}

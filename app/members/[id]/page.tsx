import { Suspense } from "react";
import { MemberProfileSkeleton } from "@/components/ui/Skeleton";
import MemberProfileLoader from "./MemberProfileLoader";

export const dynamic = "force-dynamic";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: memberIdStr } = await params;

  return (
    <Suspense fallback={<MemberProfileSkeleton />}>
      <MemberProfileLoader memberIdStr={memberIdStr} />
    </Suspense>
  );
}

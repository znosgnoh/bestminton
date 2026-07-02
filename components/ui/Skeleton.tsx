interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-amber-100/80 dark:bg-gray-800/80 ${className}`}
      aria-hidden
    />
  );
}

export function MatchCardSkeleton() {
  return (
    <div className="tet-card p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex justify-between pt-1">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function MatchDetailSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Skeleton className="h-4 w-24" />
      <div className="tet-card p-5 space-y-3">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="tet-card p-4">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ManagementSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <MatchCardSkeleton />
        <MatchCardSkeleton />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-28" />
        <MatchCardSkeleton />
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="mx-auto max-w-lg">
      <div className="tet-tab-bar">
        <Skeleton className="mx-2 my-2 h-9 flex-1 rounded-xl" />
        <Skeleton className="mx-2 my-2 h-9 flex-1 rounded-xl" />
      </div>
      <div className="space-y-3 p-4">
        <MatchCardSkeleton />
        <MatchCardSkeleton />
        <MatchCardSkeleton />
      </div>
    </div>
  );
}

export function ChallengeCardSkeleton() {
  return (
    <div className="tet-card p-4 space-y-3">
      <div className="flex justify-between gap-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

export function ChallengesListSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <ChallengeCardSkeleton />
        <ChallengeCardSkeleton />
        <ChallengeCardSkeleton />
      </div>
    </div>
  );
}

export function ChallengeDetailSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Skeleton className="h-4 w-24" />
      <div className="tet-card p-5 space-y-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="tet-card p-4 space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>
      <div className="tet-card p-4 space-y-2">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Skeleton className="h-8 w-36" />
      <div className="tet-card divide-y divide-amber-100/60 dark:divide-gray-800">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-5 w-6" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CamPageSkeleton() {
  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Skeleton className="h-8 w-28" />
      <div className="space-y-3">
        <ChallengeCardSkeleton />
        <ChallengeCardSkeleton />
      </div>
    </div>
  );
}

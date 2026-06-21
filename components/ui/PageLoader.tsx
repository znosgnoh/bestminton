import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface PageLoaderProps {
  label?: string;
}

export default function PageLoader({ label }: PageLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status" aria-live="polite">
      <LoadingSpinner size={28} className="text-emerald-600 dark:text-amber-400" />
      {label && <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>}
    </div>
  );
}

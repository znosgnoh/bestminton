import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-300">
      <AlertCircle size={20} className="mt-0.5 shrink-0" />
      <div className="flex-1 text-sm">{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-red-100 dark:bg-red-900 px-3 py-1.5 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-800 active:bg-red-300"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </div>
  );
}

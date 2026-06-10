import Spinner from "./Spinner";

export interface LoadingScreenProps {
  label?: string;
  error?: string | null;
  onRetry?: () => void;
}

export default function LoadingScreen({
  label = "Loading...",
  error,
  onRetry,
}: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-cinema-900 flex items-center justify-center">
      <div className="text-center">
        <Spinner className="w-12 h-12 border-4 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-cinema-400">{label}</p>
        {error && (
          <div className="mt-4">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-primary text-cinema rounded-lg text-sm font-medium hover:bg-primary/90"
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

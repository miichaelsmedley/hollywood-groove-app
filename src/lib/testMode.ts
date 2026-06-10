import { useSearchParams } from "react-router-dom";

/**
 * Hook to get test mode from URL params.
 * Teams uses ?test=true to indicate test mode.
 */
export function useIsTestMode(): boolean {
  const [searchParams] = useSearchParams();
  return searchParams.get("test") === "true";
}

/**
 * Get URL with test mode param preserved.
 */
export function getTestAwareUrl(path: string, isTestMode: boolean): string {
  return isTestMode ? `${path}?test=true` : path;
}

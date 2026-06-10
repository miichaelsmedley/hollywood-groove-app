import type { ReactNode } from "react";

export default function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-cinema-200 bg-cinema-50 p-4 text-sm text-cinema-700">
      {children}
    </div>
  );
}

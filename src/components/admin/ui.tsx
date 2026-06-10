import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import EmptyState from "../ui/EmptyState";

export { EmptyState };

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string;
  Icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-cinema-600 font-medium">{label}</p>
          <p className="text-2xl font-bold text-cinema-900 mt-1">{value}</p>
        </div>
        <span className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </span>
      </div>
    </div>
  );
}

export function ReadinessCard({
  ok,
  title,
  description,
}: {
  ok: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-cinema-200 bg-cinema-50 p-4">
      <div className="flex items-start gap-3">
        {ok ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        )}
        <div>
          <p className="text-sm font-bold text-cinema-900">{title}</p>
          <p className="text-xs text-cinema-600 mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function SectionHeader({
  Icon,
  title,
}: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <header className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-xl font-bold text-cinema-900">{title}</h2>
    </header>
  );
}

import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export interface ErrorCardProps {
  title: string;
  children?: ReactNode;
}

export default function ErrorCard({ title, children }: ErrorCardProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div>
          <h1 className="font-bold">{title}</h1>
          {children && <div className="text-sm mt-1">{children}</div>}
        </div>
      </div>
    </div>
  );
}

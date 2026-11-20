import { cn } from "./cn";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  info: "bg-cyan-50 text-cyan-800 ring-cyan-200",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export const statusTone: Record<string, Tone> = {
  pending: "warning",
  active: "success",
  approved: "success",
  valid: "success",
  published: "success",
  submitted: "info",
  expired: "neutral",
  draft: "neutral",
  archived: "neutral",
  cancelled: "neutral",
  rejected: "danger",
  revoked: "danger",
  refunded: "brand",
  suspended: "danger",
  needs_revision: "warning",
  in_progress: "info",
};

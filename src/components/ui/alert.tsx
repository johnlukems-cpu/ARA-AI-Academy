import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { cn } from "./cn";

const styles = {
  success: { box: "bg-emerald-50 text-emerald-900 ring-emerald-200", icon: CheckCircle2, ic: "text-emerald-600" },
  error: { box: "bg-rose-50 text-rose-900 ring-rose-200", icon: XCircle, ic: "text-rose-600" },
  warning: { box: "bg-amber-50 text-amber-900 ring-amber-200", icon: AlertTriangle, ic: "text-amber-600" },
  info: { box: "bg-brand-50 text-brand-900 ring-brand-200", icon: Info, ic: "text-brand-600" },
};

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof styles; title?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  const s = styles[tone];
  const Icon = s.icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset", s.box, className)}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", s.ic)} aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : undefined}>{children}</div> : null}
      </div>
    </div>
  );
}

import { cn } from "./cn";

export function PageHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-slate-500 sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, children, className }: { icon?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 text-brand-500">{icon}</div> : null}
      <p className="font-semibold text-slate-800">{title}</p>
      {children ? <div className="mt-2 max-w-md text-sm text-slate-500">{children}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, className }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon ? <span className="rounded-lg bg-brand-50 p-2 text-brand-600">{icon}</span> : null}
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-slate-900 sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", className)}>{children}</th>;
}
export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("px-4 py-3 align-top text-slate-700", className)}>{children}</td>;
}

export function DefinitionList({ items, className }: { items: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-slate-100", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-3 sm:gap-4">
          <dt className="text-sm text-slate-500">{k}</dt>
          <dd className="text-sm font-medium text-slate-900 sm:col-span-2 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

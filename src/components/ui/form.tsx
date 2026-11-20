import { cn } from "./cn";

const fieldBase =
  "block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-500";

export function Label({ htmlFor, children, hint, required }: { htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-800">
      {children}
      {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      {hint ? <span className="mt-0.5 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "min-h-24", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex items-start gap-2.5 text-sm text-slate-700", className)}>
      <input type="checkbox" className="mt-0.5 size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Field({ label, htmlFor, hint, required, error, children, className }: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} hint={hint} required={required}>
        {label}
      </Label>
      {children}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

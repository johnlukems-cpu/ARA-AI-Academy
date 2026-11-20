import { cn } from "./cn";

export function ProgressBar({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("w-full", className)}>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-[width] duration-500" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 56 }: { value: number; size?: number }) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0ff" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#pr)" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c} />
      <defs>
        <linearGradient id="pr" x1="0" x2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

import { cn } from "./cn";

/** Original ARA AI Academy mark: an "A" formed by a neural path with a spark node. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id="ara-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6460F0" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#ara-g)" />
      <path d="M11 30 L20 10 L29 30" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 23 H25" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="20" cy="10" r="3.2" fill="#F5B841" stroke="#fff" strokeWidth="1.6" />
    </svg>
  );
}

export function Logo({ className, dark = false, name = "ARA AI Academy" }: { className?: string; dark?: boolean; name?: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-display text-lg font-bold tracking-tight", dark ? "text-white" : "text-ink")}>
        {first} <span className={dark ? "text-accent-300" : "text-brand-600"}>{rest.join(" ")}</span>
      </span>
    </span>
  );
}

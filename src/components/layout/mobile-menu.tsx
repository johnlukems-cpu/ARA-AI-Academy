"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function MobileMenu({ links, label, footer }: { links: { href: string; label: string }[]; label: string; footer?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={label} className="rounded-lg p-2 text-slate-700 hover:bg-slate-100">
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-full z-40 border-b border-slate-200 bg-white px-4 pb-6 pt-2 shadow-lg">
          <nav className="flex flex-col">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2.5 text-base font-medium text-slate-800 hover:bg-slate-50">
                {l.label}
              </Link>
            ))}
          </nav>
          {footer ? <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

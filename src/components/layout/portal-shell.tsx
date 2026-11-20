"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Menu, X, LogOut, LayoutDashboard, BookOpen, Compass, CreditCard, Award, Bell, UserCircle, Users, Wallet,
  GraduationCap, ClipboardCheck, BarChart3, Mail, Settings, ScrollText, Globe, ListChecks,
} from "lucide-react";

const icons = {
  dashboard: LayoutDashboard, learning: BookOpen, browse: Compass, payments: CreditCard, certificates: Award,
  notifications: Bell, profile: UserCircle, students: Users, wallet: Wallet, courses: GraduationCap,
  submissions: ClipboardCheck, reports: BarChart3, messages: Mail, settings: Settings, audit: ScrollText,
  site: Globe, enrollments: ListChecks,
};
export type IconName = keyof typeof icons;
import { Logo } from "@/components/ui/logo";
import { cn } from "@/components/ui/cn";
import { LanguageSwitcher } from "./language-switcher";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean };

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = icons[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className={cn("size-[18px]", active ? "text-accent-300" : "")} aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.badge ? <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-ink">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function PortalShell({
  items,
  secondary,
  user,
  homeHref,
  logoutLabel,
  locale,
  areaLabel,
  children,
}: {
  items: NavItem[];
  secondary?: NavItem[];
  user: { name: string; email: string; avatar?: string | null };
  homeHref: string;
  logoutLabel: string;
  locale: string;
  areaLabel?: string;
  children: React.ReactNode;
}) {
  // The drawer belongs to the path it was opened on, so navigating closes it.
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);

  const sidebar = (
    <div className="flex h-full flex-col bg-ink px-4 py-5">
      <div className="flex items-center justify-between px-2">
        <Link href={homeHref}><Logo dark /></Link>
        <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setOpen(false)} aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      {areaLabel ? <p className="mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{areaLabel}</p> : null}
      <div className="mt-3 flex-1 overflow-y-auto">
        <NavLinks items={items} onNavigate={() => setOpen(false)} />
        {secondary?.length ? (
          <div className="mt-6 border-t border-white/10 pt-4">
            <NavLinks items={secondary} onNavigate={() => setOpen(false)} />
          </div>
        ) : null}
      </div>
      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 px-2">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="size-9 rounded-full object-cover ring-2 ring-white/10" />
          ) : (
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
          </div>
        </div>
        <form action={`/auth/signout?locale=${locale}`} method="post" className="mt-3">
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
            <LogOut className="size-[18px]" />
            {logoutLabel}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw]">{sidebar}</aside>
        </div>
      ) : null}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:justify-end">
          <button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <Link href={homeHref} className="lg:hidden"><Logo /></Link>
          <Suspense><LanguageSwitcher /></Suspense>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

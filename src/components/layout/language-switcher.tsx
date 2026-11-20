"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { otherLocale } from "@/i18n/config";
import { setPreferredLocale } from "@/app/actions/locale";
import { cn } from "@/components/ui/cn";

export function LanguageSwitcher({ className, dark = false }: { className?: string; dark?: boolean }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  const [pending, start] = useTransition();
  const target = otherLocale(locale);

  function switchLocale() {
    const parts = pathname.split("/");
    parts[1] = target;
    const qs = search.toString();
    start(async () => {
      await setPreferredLocale(target);
      router.replace(parts.join("/") + (qs ? `?${qs}` : ""));
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={pending}
      lang={target}
      aria-label={`${dict.nav.language}: ${dict.nav.switchTo}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
        dark ? "text-slate-200 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100",
        className,
      )}
    >
      <Globe className="size-4" aria-hidden />
      <span>{target.toUpperCase()}</span>
    </button>
  );
}

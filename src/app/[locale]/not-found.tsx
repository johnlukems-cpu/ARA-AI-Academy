import Link from "next/link";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark className="size-12" />
      <h1 className="text-3xl font-bold">404</h1>
      <p className="text-slate-600">Pagina niet gevonden · Page not found</p>
      <div className="flex gap-3 text-sm font-semibold text-brand-600">
        <Link href="/nl">Naar home</Link>
        <span className="text-slate-300">|</span>
        <Link href="/en">Go home</Link>
      </div>
    </main>
  );
}

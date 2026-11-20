import { cn } from "@/components/ui/cn";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function SectionHeading({ eyebrow, title, text, center = false, dark = false }: { eyebrow?: string; title: string; text?: string; center?: boolean; dark?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow ? <p className={cn("text-sm font-semibold uppercase tracking-wider", dark ? "text-accent-300" : "text-brand-600")}>{eyebrow}</p> : null}
      <h2 className={cn("mt-2 text-3xl font-bold sm:text-4xl", dark ? "text-white" : "text-slate-900")}>{title}</h2>
      {text ? <p className={cn("mt-3 text-base sm:text-lg", dark ? "text-slate-300" : "text-slate-600")}>{text}</p> : null}
    </div>
  );
}

export function PageHero({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="bg-grid absolute inset-0" aria-hidden />
      <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
      <Container className="relative py-14 sm:py-20">
        <h1 className="max-w-3xl text-3xl font-bold text-white sm:text-5xl">{title}</h1>
        {text ? <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">{text}</p> : null}
        {children}
      </Container>
    </section>
  );
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-slate-200 rounded-2xl bg-white shadow-card ring-1 ring-slate-200/70">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-4 sm:px-6 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
            {item.q}
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export function Markdownish({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="mb-3 whitespace-pre-line">{p}</p>
      ))}
    </>
  );
}

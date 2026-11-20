"use client";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { dict } = useI18n();
  useEffect(() => console.error(error), [error]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-bold">{dict.errors.generic}</h1>
      {error.digest ? <p className="text-xs text-slate-400">ref: {error.digest}</p> : null}
      <Button onClick={reset}>{dict.common.back}</Button>
    </main>
  );
}

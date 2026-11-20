import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Mail, Phone, MessageCircle, MapPin } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getSettings } from "@/lib/data/catalog";
import { Container, PageHero } from "@/components/public/section";
import { ContactForm } from "@/components/public/contact-form";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).contact.title } : {};
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const s = await getSettings();
  const items = [
    s.contact_email && { icon: Mail, label: dict.contact.email, value: s.contact_email, href: `mailto:${s.contact_email}` },
    s.contact_phone && { icon: Phone, label: dict.contact.phone, value: s.contact_phone, href: `tel:${s.contact_phone.replace(/\s/g, "")}` },
    s.contact_whatsapp && { icon: MessageCircle, label: dict.contact.whatsapp, value: s.contact_whatsapp, href: `https://wa.me/${s.contact_whatsapp.replace(/\D/g, "")}` },
    s.address && { icon: MapPin, label: dict.contact.address, value: s.address },
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href?: string }[];
  return (
    <>
      <PageHero title={dict.contact.title} text={dict.contact.intro} />
      <Container className="grid gap-8 py-16 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-slate-200/70 sm:p-8 lg:col-span-2">
          <ContactForm />
        </div>
        {items.length > 0 ? (
          <aside className="rounded-2xl bg-ink p-6 text-slate-300">
            <h2 className="font-bold text-white">{dict.contact.details}</h2>
            <ul className="mt-5 space-y-4">
              {items.map((i) => (
                <li key={i.label} className="flex gap-3">
                  <i.icon className="mt-0.5 size-5 text-accent-300" />
                  <div>
                    <p className="text-xs text-slate-400">{i.label}</p>
                    {i.href ? <a href={i.href} className="text-sm font-medium text-white hover:underline">{i.value}</a> : <p className="text-sm text-white">{i.value}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </Container>
    </>
  );
}

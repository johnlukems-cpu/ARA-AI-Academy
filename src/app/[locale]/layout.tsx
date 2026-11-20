import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";
import { I18nProvider } from "@/i18n/client";
import { getDictionary } from "@/i18n";
import { isLocale, locales } from "@/i18n/config";
import { publicEnv } from "@/lib/env";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap", weight: ["500", "600", "700", "800"] });

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: `${dict.meta.title} – ${dict.meta.tagline}`, template: `%s | ${dict.meta.title}` },
    description: dict.meta.description,
    icons: { icon: "/icon.svg" },
    alternates: { languages: { nl: "/nl", en: "/en" } },
    openGraph: { title: dict.meta.title, description: dict.meta.description, siteName: dict.meta.title, locale: locale === "nl" ? "nl_SR" : "en_US", type: "website" },
  };
}

export const viewport: Viewport = { themeColor: "#0b1023", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  return (
    <html lang={locale} className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-dvh">
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}

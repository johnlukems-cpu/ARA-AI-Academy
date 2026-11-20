import nl, { type Dictionary } from "./dictionaries/nl";
import en from "./dictionaries/en";
import type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = { nl, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? nl;
}

export { fmt } from "./format";

export type { Dictionary, Locale };

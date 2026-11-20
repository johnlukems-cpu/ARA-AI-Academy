export const countryCodes = [
  "SR", "NL", "GY", "GF", "BR", "TT", "CW", "AW", "BQ", "SX", "JM", "BB", "VE", "CO", "US", "CA", "BE", "DE", "FR", "GB", "ES", "PT", "IN", "ID", "CN", "GH", "NG", "ZA",
];

export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryOptions(locale: string) {
  const opts = countryCodes.map((c) => ({ code: c, name: countryName(c, locale) }));
  const [first, ...rest] = opts; // keep Suriname first
  return [first, ...rest.sort((a, b) => a.name.localeCompare(b.name, locale))];
}

/** Replace {placeholders} in a translated string (client-safe). */
export function fmt(template: string, values: Record<string, string | number | undefined | null> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

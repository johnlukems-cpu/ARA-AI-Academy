import { describe, expect, it } from "vitest";
import { escapeHtml, interpolate, renderBody } from "@/lib/email/render";
import { defaultTemplates, templateKeys, templateVariables } from "@/lib/email/templates";

describe("email rendering", () => {
  it("escapes HTML in variables so user input cannot inject markup", () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;");
    const { html } = renderBody("Hallo {{name}}", { name: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
  it("interpolates known variables and blanks unknown ones", () => {
    expect(interpolate("{{a}} en {{b}}", { a: "1" })).toBe("1 en ");
  });
  it("renders buttons only for http(s) links", () => {
    expect(renderBody("[[button:Open|https://example.com/x]]", {}).html).toContain('href="https://example.com/x"');
    expect(renderBody("[[button:Open|javascript:alert(1)]]", {}).html).not.toContain("javascript:");
    expect(renderBody("[[button:Open|{{url}}]]", { url: "https://academy.example/a?b=1&c=2" }).html).toContain('href="https://academy.example/a?b=1&amp;c=2"');
  });
  it("does not turn variable content into links or bold text", () => {
    const { html } = renderBody("Bericht: {{message}}", { message: "[klik](https://evil.example) **x**" });
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<strong>");
  });
  it("has NL and EN versions for every template, using only declared variables", () => {
    for (const key of templateKeys) {
      for (const l of ["nl", "en"] as const) {
        const t = defaultTemplates[key][l];
        expect(t.subject.length, `${key}.${l}`).toBeGreaterThan(0);
        const used = [...`${t.subject} ${t.body}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
        for (const v of used) expect(templateVariables[key], `${key}.${l} uses {{${v}}}`).toContain(v);
      }
    }
  });
});

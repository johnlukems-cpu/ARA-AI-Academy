/** Pure rendering helpers for email templates (unit tested). */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function interpolate(template: string, vars: Record<string, string | number | null | undefined>, escape = false): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    const s = v === undefined || v === null ? "" : String(v);
    return escape ? escapeHtml(s) : s;
  });
}

const safeUrl = (u: string) => (/^(https?:|mailto:)/i.test(u) ? u : "#");

function inline(html: string): string {
  return html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, url: string) => `<a href="${safeUrl(url)}" style="color:#4F46E5">${text}</a>`);
}

/** Render template body to { html, text }. Template text and variables are HTML-escaped first. */
export function renderBody(body: string, vars: Record<string, string | number | null | undefined>, accent = "#4F46E5") {
  const filled = interpolate(escapeHtml(body), vars, true);
  const blocks = filled.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const htmlBlocks = blocks.map((block) => {
    const btn = block.match(/^\[\[button:([^|\]]+)\|([^\]]+)\]\]$/);
    if (btn) {
      return `<p style="margin:28px 0"><a href="${safeUrl(btn[2].trim())}" style="background:${accent};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${btn[1].trim()}</a></p>`;
    }
    return `<p style="margin:0 0 16px;line-height:1.6">${inline(block).replace(/\n/g, "<br>")}</p>`;
  });
  const textPlain = interpolate(body, vars)
    .replace(/\[\[button:([^|\]]+)\|([^\]]+)\]\]/g, "$1: $2")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)");
  return { html: htmlBlocks.join("\n"), text: textPlain };
}

export function layoutEmail(innerHtml: string, opts: { academyName: string; footer: string; siteUrl: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F4F5FB;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0F172A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5FB;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0">
<tr><td style="background:#0B1023;padding:22px 32px"><a href="${escapeHtml(opts.siteUrl)}" style="color:#ffffff;text-decoration:none;font-weight:700;font-size:18px;letter-spacing:.2px">${escapeHtml(opts.academyName)}</a></td></tr>
<tr><td style="padding:32px;font-size:15px">${innerHtml}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #E2E8F0;color:#64748B;font-size:12px">${escapeHtml(opts.footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Build a safe embed for a lesson video. Only whitelisted hosts are ever embedded. */
export type VideoEmbed = { kind: "iframe"; src: string } | { kind: "file"; src: string } | null;

const YT_ID = /^[A-Za-z0-9_-]{6,20}$/;

function parseUrl(v: string): URL | null {
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

export function videoEmbed(provider: string | null | undefined, ref: string | null | undefined): VideoEmbed {
  const v = (ref ?? "").trim();
  if (!provider || !v) return null;
  switch (provider) {
    case "youtube": {
      let id = v;
      const u = parseUrl(v);
      if (u) {
        if (u.hostname === "youtu.be") id = u.pathname.slice(1);
        else if (/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop() ?? "";
        else return null;
      }
      return YT_ID.test(id) ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` } : null;
    }
    case "vimeo": {
      let id = v;
      const u = parseUrl(v);
      if (u) {
        if (!/(^|\.)vimeo\.com$/.test(u.hostname)) return null;
        id = u.pathname.split("/").filter(Boolean).pop() ?? "";
      }
      return /^\d{5,12}$/.test(id) ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}?dnt=1` } : null;
    }
    case "bunny": {
      const u = parseUrl(v);
      return u && (u.hostname === "iframe.mediadelivery.net" || u.hostname === "player.mediadelivery.net") ? { kind: "iframe", src: u.toString() } : null;
    }
    case "url": {
      const u = parseUrl(v);
      return u ? { kind: "file", src: u.toString() } : null;
    }
    default:
      return null;
  }
}

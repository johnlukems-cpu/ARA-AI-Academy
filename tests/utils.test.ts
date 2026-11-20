import { describe, expect, it } from "vitest";
import { daysRemaining, formatMoney } from "@/lib/format";
import { videoEmbed } from "@/lib/video";
import { dueReminder } from "@/lib/cron";
import { toCsv } from "@/lib/reports";
import { safeNext } from "@/lib/validation";

describe("format", () => {
  it("counts remaining access days, never negative", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    expect(daysRemaining("2027-02-18T12:00:00Z", now)).toBe(90);
    expect(daysRemaining("2026-11-20T13:00:00Z", now)).toBe(1);
    expect(daysRemaining("2026-11-01T00:00:00Z", now)).toBe(0);
  });
  it("formats SRD amounts", () => {
    expect(formatMoney(2500, "SRD", "nl")).toMatch(/SRD/);
    expect(formatMoney(2500, "SRD", "nl")).toMatch(/2\.500/);
  });
});

describe("videoEmbed", () => {
  it("accepts YouTube ids and URLs, Vimeo ids and https files", () => {
    expect(videoEmbed("youtube", "dQw4w9WgXcQ")).toEqual({ kind: "iframe", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0" });
    expect(videoEmbed("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.src).toContain("dQw4w9WgXcQ");
    expect(videoEmbed("youtube", "https://youtu.be/dQw4w9WgXcQ")?.src).toContain("dQw4w9WgXcQ");
    expect(videoEmbed("vimeo", "https://vimeo.com/76979871")?.src).toBe("https://player.vimeo.com/video/76979871?dnt=1");
    expect(videoEmbed("url", "https://cdn.example.com/a.mp4")).toEqual({ kind: "file", src: "https://cdn.example.com/a.mp4" });
  });
  it("rejects foreign hosts and unsafe schemes", () => {
    expect(videoEmbed("youtube", "https://evil.example/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbed("bunny", "https://evil.example/embed/1/2")).toBeNull();
    expect(videoEmbed("url", "javascript:alert(1)")).toBeNull();
    expect(videoEmbed("url", "http://insecure.example/a.mp4")).toBeNull();
    expect(videoEmbed("youtube", "<script>")).toBeNull();
  });
});

describe("dueReminder", () => {
  const now = new Date("2026-11-20T11:00:00Z");
  const at = (days: number) => new Date(now.getTime() + days * 86_400_000 - 60_000);
  it("picks the smallest reminder that covers the remaining days", () => {
    expect(dueReminder(at(30), now, [30, 14, 7, 1])).toBe(30);
    expect(dueReminder(at(20), now, [30, 14, 7, 1])).toBe(30);
    expect(dueReminder(at(14), now, [30, 14, 7, 1])).toBe(14);
    expect(dueReminder(at(7), now, [30, 14, 7, 1])).toBe(7);
    expect(dueReminder(at(1), now, [30, 14, 7, 1])).toBe(1);
    expect(dueReminder(at(45), now, [30, 14, 7, 1])).toBeNull();
    expect(dueReminder(new Date(now.getTime() - 1000), now, [30, 14, 7, 1])).toBeNull();
  });
});

describe("csv export", () => {
  it("quotes, adds a BOM and neutralises formula injection", () => {
    const csv = toCsv({ columns: ["Naam", "Notitie"], rows: [["Jansen, P.", "=HYPERLINK(\"x\")"], ["Anaïs", null]] });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Jansen, P."');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("Anaïs,");
  });
});

describe("safeNext", () => {
  it("only allows local paths", () => {
    expect(safeNext("/nl/dashboard", "/nl")).toBe("/nl/dashboard");
    expect(safeNext("//evil.com", "/nl")).toBe("/nl");
    expect(safeNext("https://evil.com", "/nl")).toBe("/nl");
  });
});

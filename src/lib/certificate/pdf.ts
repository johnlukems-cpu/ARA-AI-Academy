import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import QRCode from "qrcode";

export type CertificateInput = {
  recipientName: string;
  courseTitle: string;
  completionDate: string; // already formatted
  code: string;
  verifyUrl: string;
  academyName: string;
  companyName: string;
  signatoryName: string | null;
  signatoryTitle: string | null;
  signaturePng?: Uint8Array | null;
  signatureJpg?: Uint8Array | null;
  accentColor: string;
  labels: {
    title: string; presented: string; completed: string; date: string; id: string; verify: string; disclaimer: string;
  };
};

function hexToRgb(hex: string, fallback: RGB = rgb(0.31, 0.27, 0.9)): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const TRANSLIT: Record<string, string> = { "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "ı": "i", "Ħ": "H", "ħ": "h", "ŧ": "t", "Ŧ": "T" };

/**
 * Standard PDF fonts only cover WinAnsi. Keep every character the font can encode and
 * strip diacritics (or substitute "?") for the rest, so unusual names never crash generation.
 */
export function safeText(text: string, font: PDFFont): string {
  let out = "";
  for (const ch of text) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      const base = (TRANSLIT[ch] ?? ch).normalize("NFD").replace(/[̀-ͯ]/g, "");
      try {
        font.encodeText(base);
        out += base;
      } catch {
        out += "?";
      }
    }
  }
  return out;
}

function centered(page: PDFPage, text: string, y: number, font: PDFFont, size: number, color: RGB, maxWidth: number) {
  let s = size;
  const t = safeText(text, font);
  while (s > 8 && font.widthOfTextAtSize(t, s) > maxWidth) s -= 1;
  const w = font.widthOfTextAtSize(t, s);
  page.drawText(t, { x: (page.getWidth() - w) / 2, y, size: s, font, color });
  return s;
}

/** Wrap text into lines that fit maxWidth. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safeText(text, font).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateCertificatePdf(input: CertificateInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${input.labels.title} – ${input.recipientName}`);
  doc.setAuthor(input.academyName);
  doc.setSubject(input.courseTitle);
  doc.setCreator(input.academyName);
  doc.setProducer(input.academyName);

  const page = doc.addPage([841.89, 595.28]); // A4 landscape
  const { width, height } = page.getSize();
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const accent = hexToRgb(input.accentColor);
  const ink = rgb(0.043, 0.063, 0.137);
  const muted = rgb(0.39, 0.44, 0.52);
  const gold = rgb(0.96, 0.72, 0.25);

  // Background and frame
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0, y: height - 14, width, height: 14, color: accent });
  page.drawRectangle({ x: 0, y: 0, width, height: 6, color: gold });
  page.drawRectangle({ x: 28, y: 28, width: width - 56, height: height - 70, borderColor: accent, borderWidth: 1.2, opacity: 0 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 82, borderColor: rgb(0.85, 0.87, 0.93), borderWidth: 0.6, opacity: 0 });

  // Logo mark (vector, drawn from the brand SVG geometry: 40x40 box)
  const logoSize = 46;
  const lx = width / 2 - logoSize / 2;
  const ly = height - 50;
  const scale = logoSize / 40;
  page.drawSvgPath("M11 0 H29 A11 11 0 0 1 40 11 V29 A11 11 0 0 1 29 40 H11 A11 11 0 0 1 0 29 V11 A11 11 0 0 1 11 0 Z", { x: lx, y: ly, scale, color: accent });
  page.drawSvgPath("M11 30 L20 10 L29 30", { x: lx, y: ly, scale, borderColor: rgb(1, 1, 1), borderWidth: 3.2 * scale, borderLineCap: 1 });
  page.drawSvgPath("M15 23 H25", { x: lx, y: ly, scale, borderColor: rgb(1, 1, 1), borderWidth: 3.2 * scale, borderLineCap: 1 });
  page.drawCircle({ x: lx + 20 * scale, y: ly - 10 * scale, size: 3.2 * scale, color: gold, borderColor: rgb(1, 1, 1), borderWidth: 1.6 * scale });

  centered(page, input.academyName.toUpperCase(), height - 112, sansBold, 11, muted, width - 200);
  centered(page, input.labels.title, height - 152, sansBold, 30, ink, width - 160);
  page.drawRectangle({ x: width / 2 - 40, y: height - 166, width: 80, height: 2.5, color: gold });
  centered(page, input.labels.presented, height - 198, sans, 13, muted, width - 200);
  centered(page, input.recipientName, height - 246, serif, 40, accent, width - 140);
  page.drawLine({ start: { x: width / 2 - 220, y: height - 258 }, end: { x: width / 2 + 220, y: height - 258 }, thickness: 0.6, color: rgb(0.8, 0.82, 0.88) });
  centered(page, input.labels.completed, height - 284, sans, 13, muted, width - 200);

  const titleLines = wrap(input.courseTitle, sansBold, 22, width - 220).slice(0, 2);
  titleLines.forEach((ln, i) => centered(page, ln, height - 318 - i * 28, sansBold, 22, ink, width - 200));

  // Footer: date, signature, QR
  const baseY = 92;
  const colW = 200;
  const leftX = 80;
  page.drawText(safeText(input.labels.date, sans), { x: leftX, y: baseY + 34, size: 9, font: sans, color: muted });
  page.drawText(safeText(input.completionDate, sansBold), { x: leftX, y: baseY + 18, size: 13, font: sansBold, color: ink });
  page.drawText(safeText(input.labels.id, sans), { x: leftX, y: baseY - 6, size: 9, font: sans, color: muted });
  page.drawText(safeText(input.code, sansBold), { x: leftX, y: baseY - 22, size: 12, font: sansBold, color: ink });

  const sigX = width / 2 - colW / 2;
  if (input.signaturePng || input.signatureJpg) {
    try {
      const img = input.signaturePng ? await doc.embedPng(input.signaturePng) : await doc.embedJpg(input.signatureJpg!);
      const dims = img.scaleToFit(colW - 20, 48);
      page.drawImage(img, { x: width / 2 - dims.width / 2, y: baseY + 14, width: dims.width, height: dims.height });
    } catch {
      /* invalid image: leave the line empty */
    }
  }
  page.drawLine({ start: { x: sigX, y: baseY + 10 }, end: { x: sigX + colW, y: baseY + 10 }, thickness: 0.8, color: ink });
  if (input.signatoryName) centered(page, input.signatoryName, baseY - 6, sansBold, 11, ink, colW);
  centered(page, [input.signatoryTitle, input.companyName].filter(Boolean).join(", "), baseY - 20, sans, 9, muted, colW + 60);

  const qrPng = await QRCode.toBuffer(input.verifyUrl, { type: "png", margin: 1, width: 240, errorCorrectionLevel: "M", color: { dark: "#0b1023", light: "#ffffff" } });
  const qr = await doc.embedPng(qrPng);
  const qrSize = 76;
  const qrX = width - 80 - qrSize;
  page.drawImage(qr, { x: qrX, y: baseY - 26, width: qrSize, height: qrSize });
  const vLabel = safeText(input.labels.verify, sans);
  page.drawText(vLabel, { x: qrX + qrSize - sans.widthOfTextAtSize(vLabel, 8), y: baseY + 64, size: 8, font: sans, color: muted });
  const url = safeText(input.verifyUrl.replace(/^https?:\/\//, ""), sans);
  const urlSize = Math.min(7.5, (qrSize + 90) / Math.max(1, sans.widthOfTextAtSize(url, 1)));
  page.drawText(url, { x: qrX + qrSize - sans.widthOfTextAtSize(url, urlSize), y: baseY + 54, size: urlSize, font: sans, color: muted });

  const disc = wrap(input.labels.disclaimer, sans, 7.5, width - 160);
  disc.slice(0, 2).forEach((ln, i) => centered(page, ln, 46 - i * 10, sans, 7.5, muted, width - 160));

  return doc.save();
}

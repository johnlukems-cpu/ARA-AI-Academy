import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { generateCertificatePdf, safeText } from "@/lib/certificate/pdf";
import nl from "@/i18n/dictionaries/nl";

const labels = {
  title: nl.certificates.pdfTitle, presented: nl.certificates.pdfPresented, completed: nl.certificates.pdfCompleted,
  date: nl.certificates.pdfDate, id: nl.certificates.pdfId, verify: nl.certificates.pdfVerify, disclaimer: nl.certificates.pdfDisclaimer,
};

describe("certificate pdf", () => {
  it("renders a one-page landscape PDF with metadata", async () => {
    const bytes = await generateCertificatePdf({
      recipientName: "Anaïs Ramdin-Wongsodikromo",
      courseTitle: "AI voor ondernemers: slimmer werken met ChatGPT en automatisering",
      completionDate: "20 november 2026",
      code: "ARA-2026-AB12CD34",
      verifyUrl: "https://academy.example.sr/verify/ARA-2026-AB12CD34",
      academyName: "ARA AI Academy",
      companyName: "ARA AI Solutions",
      signatoryName: "Directie ARA AI Solutions",
      signatoryTitle: "Directeur",
      accentColor: "#4F46E5",
      labels,
    });
    if (process.env.CERT_OUT) writeFileSync(process.env.CERT_OUT, bytes);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
    expect(w).toBeGreaterThan(h);
    expect(doc.getTitle()).toContain("Anaïs");
  });

  it("replaces characters the standard font cannot encode", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    expect(safeText("José Müller", font)).toBe("José Müller");
    expect(safeText("Łukasz 张", font)).toBe("Lukasz ?");
  });
});

import PDFDocument from "pdfkit";
import {
  CONSULTING_AGREEMENT_ARTICLES,
  CONSULTING_AGREEMENT_BRAND,
  pickLocaleText,
} from "../consulting-agreement-content";
import { normalizeConsultingAgreementParty } from "../consulting-agreement-fields";
import type { FrozenAgreementSnapshot } from "../sign-types";
import { resolveSignPdfFontPath } from "./font";
import {
  resolveSignPdfLogoPath,
  SIGN_PDF_LOGO_ASPECT,
} from "./logo";
import { pdfCopy } from "./pdf-copy";
import { writeCertificatePage, type CertificateInput } from "./pdf-certificate";

export type { CertificateInput };

function dash(value?: string | null): string {
  return (value ?? "").trim() || "____________________";
}

async function collectPdf(
  write: (doc: PDFKit.PDFDocument) => void,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    info: {
      Title: "SPIORA consulting agreement",
      Author: "SPIORA",
      Creator: "SPIORA Sign",
    },
    autoFirstPage: true,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const fontPath = resolveSignPdfFontPath();
  doc.font(fontPath);
  doc.fontSize(11);
  write(doc);
  doc.end();
  return done;
}

function drawAgreementLogo(doc: PDFKit.PDFDocument) {
  const logoPath = resolveSignPdfLogoPath();
  if (!logoPath) {
    return;
  }
  const padX = 16;
  const padY = 10;
  const imgWidth = 168;
  const imgHeight = imgWidth / SIGN_PDF_LOGO_ASPECT;
  const boxWidth = imgWidth + padX * 2;
  const boxHeight = imgHeight + padY * 2;
  const x = (doc.page.width - boxWidth) / 2;
  const y = doc.y;
  doc.save();
  doc.roundedRect(x, y, boxWidth, boxHeight, 4).fill("#000000");
  doc.image(logoPath, x + padX, y + padY, { width: imgWidth, height: imgHeight });
  doc.restore();
  doc.y = y + boxHeight + 12;
}

function writeAgreementBody(
  doc: PDFKit.PDFDocument,
  snapshot: FrozenAgreementSnapshot,
) {
  const locale = snapshot.locale;
  const copy = pdfCopy(locale);
  const party = normalizeConsultingAgreementParty(snapshot.party);

  drawAgreementLogo(doc);
  doc
    .fontSize(10)
    .text(pickLocaleText(CONSULTING_AGREEMENT_BRAND.program, locale), {
      align: "center",
    });
  doc.moveDown(0.4);
  doc
    .fontSize(13)
    .text(pickLocaleText(CONSULTING_AGREEMENT_BRAND.title, locale), {
      align: "center",
    });
  doc.moveDown(0.3);
  doc.fontSize(11).text(`${copy.no} ${snapshot.agreementNumber}`, {
    align: "center",
  });
  doc.moveDown(1);

  doc.fontSize(11).text(copy.provider);
  doc.text(pickLocaleText(CONSULTING_AGREEMENT_BRAND.providerLegalName, locale));
  doc.text(copy.providerHereinafter);
  doc.text(`${copy.ico} ____________________`);
  doc.text(`${copy.dic} ____________________`);
  doc.text(`${copy.authority} ____________________`);
  doc.text(`${copy.bank} ____________________`);
  doc.moveDown(0.8);

  doc.text(copy.client);
  doc.text(dash(party.fullName));
  doc.text(`${copy.passport} ${dash(party.passportNumber)}`);
  doc.text(`${copy.issued} ${dash(party.passportIssueDate)}`);
  doc.text(`${copy.country} ${dash(party.country)}`);
  doc.text(`${copy.postalCode} ${dash(party.postalCode)}`);
  doc.text(`${copy.city} ${dash(party.city)}`);
  doc.text(`${copy.address} ${dash(party.address)}`);
  doc.text(`${copy.email} ${dash(party.email)}`);
  doc.text(`${copy.phone} ${dash(party.phone)}`);
  doc.moveDown(0.6);
  doc.text(copy.jointly);
  doc.moveDown(0.8);

  for (const article of CONSULTING_AGREEMENT_ARTICLES) {
    doc
      .fontSize(12)
      .text(`${article.roman}. ${pickLocaleText(article.title, locale)}`);
    doc.moveDown(0.3);
    for (const clause of article.clauses) {
      doc.fontSize(10).text(`${clause.n}. ${clause[locale]}`, {
        align: "justify",
      });
      if (clause.items) {
        doc.moveDown(0.15);
        for (const item of clause.items) {
          doc.text(`${item.key}) ${item[locale]}`, { indent: 18 });
        }
      }
      doc.moveDown(0.35);
    }
    doc.moveDown(0.4);
  }
}

export async function buildSourceAgreementPdf(
  snapshot: FrozenAgreementSnapshot,
): Promise<Buffer> {
  return collectPdf((doc) => writeAgreementBody(doc, snapshot));
}

export async function buildFinalAgreementPdf(
  snapshot: FrozenAgreementSnapshot,
  certificate: CertificateInput,
): Promise<Buffer> {
  return collectPdf((doc) => {
    writeAgreementBody(doc, snapshot);
    writeCertificatePage(doc, certificate);
  });
}

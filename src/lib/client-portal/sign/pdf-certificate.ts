import { brandColors } from "@/config/branding";
import type { FrozenAgreementSnapshot } from "../sign-types";
import { formatSignDateTimes, pdfCopy } from "./pdf-copy";
import { getSignConfig } from "./config";
import {
  resolveSignPdfCompactLogoPath,
  resolveSignPdfLogoPath,
  SIGN_PDF_LOGO_ASPECT,
  SIGN_PDF_LOGO_COMPACT_ASPECT,
} from "./logo";

export type CertificateInput = {
  agreementNumber: string;
  versionNumber: number;
  transactionId: string;
  clientName: string;
  clientSignedAt: string;
  providerName: string;
  providerTitle: string;
  providerSignedAt: string;
  sourcePdfHash: string;
  locale: FrozenAgreementSnapshot["locale"];
};

type PdfCopy = ReturnType<typeof pdfCopy>;

const INK = "#161513";
const MUTED = "#6B6560";
const LINE = "#E8D4CF";
const TINT = "#FDF6F4";
const WHITE = "#FFFFFF";
const RED = brandColors.red;
const MONTHS_EN = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const MONTHS_RU = [
  "ЯНВ",
  "ФЕВ",
  "МАР",
  "АПР",
  "МАЯ",
  "ИЮН",
  "ИЮЛ",
  "АВГ",
  "СЕН",
  "ОКТ",
  "НОЯ",
  "ДЕК",
];

function formatStampDate(
  iso: string,
  locale: CertificateInput["locale"],
  timeZone: string,
) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
    timeZone,
  }).formatToParts(new Date(iso));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const monthIndex =
    Number(parts.find((part) => part.type === "month")?.value ?? "1") - 1;
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month =
    (locale === "ru" ? MONTHS_RU : MONTHS_EN)[Math.max(0, monthIndex)] ?? "";
  return `${day} ${month} ${year}`;
}

function groupedHash(hash: string): string {
  const clean = hash.replace(/\s/g, "");
  return clean.match(/.{1,8}/g)?.join(" ") ?? clean;
}

function textH(
  doc: PDFKit.PDFDocument,
  value: string,
  width: number,
  size: number,
): number {
  doc.fontSize(size);
  return doc.heightOfString(value, { width, lineGap: 1 });
}

function drawCheckMark(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number,
) {
  const r = size / 2;
  doc.save();
  doc.circle(x + r, y + r, r).fill(RED);
  doc.strokeColor(WHITE).lineWidth(Math.max(1.1, size / 7));
  doc
    .moveTo(x + r * 0.42, y + r)
    .lineTo(x + r * 0.72, y + r * 1.32)
    .lineTo(x + r * 1.55, y + r * 0.48);
  doc.stroke();
  doc.restore();
}

function drawLockIcon(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  size: number,
) {
  const bodyW = size * 0.72;
  const bodyH = size * 0.52;
  const bodyX = x + (size - bodyW) / 2;
  const bodyY = y + size * 0.42;
  doc.save();
  doc
    .strokeColor(MUTED)
    .lineWidth(1)
    .roundedRect(bodyX, bodyY, bodyW, bodyH, 1.2)
    .stroke();
  doc
    .moveTo(x + size * 0.3, bodyY)
    .quadraticCurveTo(x + size * 0.5, y + size * 0.02, x + size * 0.7, bodyY)
    .stroke();
  doc.restore();
}

function drawLogo(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  logoPath: string | null,
  aspect = SIGN_PDF_LOGO_ASPECT,
) {
  if (!logoPath) return 0;
  const height = width / aspect;
  doc.save();
  doc.roundedRect(x, y, width, height, 3).fill(brandColors.black);
  doc.roundedRect(x, y, width, height, 3).clip();
  doc.image(logoPath, x, y, { width, height });
  doc.restore();
  return height;
}

function drawPageFrame(doc: PDFKit.PDFDocument) {
  const page = doc.page;
  const outer = 22;
  doc.save();
  doc
    .roundedRect(outer, outer, page.width - outer * 2, page.height - outer * 2, 6)
    .lineWidth(1.15)
    .stroke(RED);
  doc
    .roundedRect(
      outer + 4,
      outer + 4,
      page.width - (outer + 4) * 2,
      page.height - (outer + 4) * 2,
      4,
    )
    .lineWidth(0.5)
    .stroke(LINE);
  doc.restore();
}

function drawVerificationBadge(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  label: string,
): number {
  const padX = 10;
  const check = 10;
  doc.fontSize(8);
  const textWidth = Math.max(40, width - padX * 2 - check - 8);
  const textHeight = doc.heightOfString(label, { width: textWidth, lineGap: 1 });
  const height = Math.max(22, textHeight + 8);
  doc.save();
  doc.roundedRect(x, y, width, height, 4).fill(TINT);
  doc.roundedRect(x, y, width, height, 4).lineWidth(1).stroke(RED);
  drawCheckMark(doc, x + padX, y + (height - check) / 2, check);
  doc.fillColor(RED).fontSize(8);
  doc.text(label, x + padX + check + 8, y + (height - textHeight) / 2, {
    width: textWidth,
    lineGap: 1,
  });
  doc.restore();
  return height;
}

type SignerCardInput = {
  heading: string;
  name: string;
  title?: string;
  confirmed: string;
  local: string;
  utc: string;
  verificationLabel: string;
  methods: string[];
  withLogo: boolean;
  logoPath: string | null;
};

function measureSignerCard(
  doc: PDFKit.PDFDocument,
  width: number,
  input: SignerCardInput,
): number {
  const inner = width - 24;
  let height = 28;
  height += textH(doc, input.name, inner, 11) + 6;
  if (input.title) height += textH(doc, input.title, inner, 8.5) + 4;
  height +=
    Math.max(22, textH(doc, input.confirmed, inner - 36, 8) + 8) + 8;
  height += textH(doc, input.local, inner, 8.5) + 2;
  height += textH(doc, input.utc, inner, 7.5) + 8;
  height += 12;
  for (const method of input.methods) {
    height += textH(doc, method, inner - 16, 8) + 4;
  }
  return height + 14;
}

function drawSignerCard(
  doc: PDFKit.PDFDocument,
  box: { x: number; y: number; width: number; height: number },
  input: SignerCardInput,
) {
  const { x, y, width, height } = box;
  doc.save();
  doc.roundedRect(x, y, width, height, 7).fill(WHITE);
  doc.roundedRect(x, y, width, height, 7).lineWidth(1).stroke(LINE);
  doc.rect(x, y, width, 24).fill(input.withLogo ? brandColors.black : INK);

  if (input.withLogo) {
    const logoW = 102;
    drawLogo(
      doc,
      x + 10,
      y + 5,
      logoW,
      input.logoPath,
      SIGN_PDF_LOGO_COMPACT_ASPECT,
    );
    doc.fillColor(WHITE).fontSize(9);
    doc.text(input.heading, x + logoW + 16, y + 7, {
      width: width - logoW - 26,
    });
  } else {
    doc.fillColor(WHITE).fontSize(9);
    doc.text(input.heading, x + 12, y + 7, { width: width - 24 });
  }

  const innerX = x + 12;
  const innerW = width - 24;
  let cursor = y + 32;
  doc.fillColor(INK).fontSize(11);
  doc.text(input.name, innerX, cursor, { width: innerW, lineGap: 1 });
  cursor = doc.y + 4;
  if (input.title) {
    doc.fillColor(MUTED).fontSize(8.5);
    doc.text(input.title, innerX, cursor, { width: innerW, lineGap: 1 });
    cursor = doc.y + 6;
  }
  cursor +=
    drawVerificationBadge(doc, innerX, cursor, innerW, input.confirmed) + 8;
  doc.fillColor(INK).fontSize(8.5);
  doc.text(input.local, innerX, cursor, { width: innerW });
  cursor = doc.y + 1;
  doc.fillColor(MUTED).fontSize(7.5);
  doc.text(input.utc, innerX, cursor, { width: innerW });
  cursor = doc.y + 7;
  doc.fillColor(MUTED).fontSize(7.5);
  doc.text(input.verificationLabel.toUpperCase(), innerX, cursor, {
    width: innerW,
  });
  cursor = doc.y + 4;
  for (const method of input.methods) {
    drawCheckMark(doc, innerX, cursor + 1, 8);
    doc.fillColor(INK).fontSize(8);
    doc.text(method, innerX + 14, cursor, { width: innerW - 16, lineGap: 1 });
    cursor = doc.y + 3;
  }
  doc.restore();
}

function drawCertificateHeader(
  doc: PDFKit.PDFDocument,
  box: { x: number; y: number; width: number },
  copy: PdfCopy,
  logoPath: string | null,
): number {
  let y = box.y;
  const headerLogoW = 156;
  const logoH = drawLogo(
    doc,
    box.x + (box.width - headerLogoW) / 2,
    y,
    headerLogoW,
    logoPath,
  );
  y += (logoH || 18) + 8;
  doc.fillColor(RED).fontSize(9.5);
  doc.text(copy.productLabel, box.x, y, { width: box.width, align: "center" });
  y = doc.y + 2;
  doc.fillColor(MUTED).fontSize(8);
  doc.text(copy.certificateSubtitle, box.x, y, {
    width: box.width,
    align: "center",
  });
  y = doc.y + 8;
  doc.fillColor(INK).fontSize(14);
  doc.text(copy.certificateTitle, box.x, y, {
    width: box.width,
    align: "center",
    lineGap: 2,
  });
  y = doc.y + 8;
  const badgeW = Math.min(box.width, 340);
  y +=
    drawVerificationBadge(
      doc,
      box.x + (box.width - badgeW) / 2,
      y,
      badgeW,
      copy.bothConfirmed,
    ) + 12;
  return y;
}

function drawMetadataBlock(
  doc: PDFKit.PDFDocument,
  box: { x: number; y: number; width: number },
  copy: PdfCopy,
  cert: CertificateInput,
): number {
  const gap = 12;
  const col = (box.width - gap) / 2;
  let y = box.y;
  doc.fillColor(MUTED).fontSize(7);
  doc.text(copy.agreementLabel, box.x, y, { width: col });
  doc.text(copy.versionLabel, box.x + col + gap, y, {
    width: col,
  });
  y = doc.y + 1;
  doc.fillColor(INK).fontSize(11);
  doc.text(`${copy.no} ${cert.agreementNumber}`, box.x, y, { width: col });
  const numberBottom = doc.y;
  doc.text(String(cert.versionNumber), box.x + col + gap, y, { width: col });
  y = Math.max(numberBottom, doc.y) + 7;
  doc.fillColor(MUTED).fontSize(7);
  doc.text(copy.transactionLabel, box.x, y, { width: box.width });
  y = doc.y + 1;
  doc.fillColor(INK).fontSize(8.5);
  doc.text(cert.transactionId, box.x, y, { width: box.width, lineGap: 1 });
  return doc.y + 12;
}

function measureStamp(height: number): number {
  return Math.max(96, Math.min(118, height));
}

function drawElectronicStamp(
  doc: PDFKit.PDFDocument,
  box: { x: number; y: number; width: number; height: number },
  copy: PdfCopy,
  dateLabel: string,
  logoPath: string | null,
) {
  const { x, y, width, height } = box;
  doc.save();
  doc.roundedRect(x, y, width, height, 9).lineWidth(1.5).stroke(RED);
  doc
    .roundedRect(x + 5, y + 5, width - 10, height - 10, 6)
    .lineWidth(0.55)
    .stroke(LINE);
  let cursor = y + 10;
  const logoW = Math.min(124, width - 40);
  const logoH = drawLogo(
    doc,
    x + (width - logoW) / 2,
    cursor,
    logoW,
    logoPath,
    SIGN_PDF_LOGO_COMPACT_ASPECT,
  );
  cursor += (logoH || 0) + 6;
  doc.fillColor(RED).fontSize(8.5);
  doc.text(copy.productLabel, x + 12, cursor, {
    width: width - 24,
    align: "center",
  });
  cursor = doc.y + 5;
  const badgeW = Math.min(width - 28, 132);
  cursor +=
    drawVerificationBadge(
      doc,
      x + (width - badgeW) / 2,
      cursor,
      badgeW,
      copy.stampConfirmed,
    ) + 6;
  doc.fillColor(INK).fontSize(7.5);
  doc.text(copy.stampElectronicDocument, x + 12, cursor, {
    width: width - 24,
    align: "center",
  });
  cursor = doc.y + 4;
  doc.fillColor(MUTED).fontSize(8);
  doc.text(dateLabel, x + 12, cursor, { width: width - 24, align: "center" });
  doc.restore();
}

function drawIntegrityBlock(
  doc: PDFKit.PDFDocument,
  box: { x: number; y: number; width: number },
  copy: PdfCopy,
  cert: CertificateInput,
): number {
  let y = box.y;
  const hash = cert.sourcePdfHash.replace(/\s/g, "");
  doc.fillColor(MUTED).fontSize(7);
  doc.text(copy.integrityTitle, box.x, y, { width: box.width });
  y = doc.y + 3;
  doc.fillColor(INK).fontSize(8);
  doc.text(copy.sourceHashLabel, box.x, y, { width: box.width });
  y = doc.y + 2;
  doc.fontSize(8);
  doc.text(groupedHash(hash), box.x, y, { width: box.width, lineGap: 2 });
  y = doc.y + 7;
  doc.fillColor(MUTED).fontSize(7);
  doc.text(copy.transactionLabel, box.x, y, { width: box.width });
  y = doc.y + 1;
  doc.fillColor(INK).fontSize(8);
  doc.text(cert.transactionId, box.x, y, { width: box.width, lineGap: 1 });
  return doc.y + 8;
}

function drawCertificateFooter(
  doc: PDFKit.PDFDocument,
  box: { x: number; y: number; width: number },
  note: string,
) {
  drawLockIcon(doc, box.x, box.y + 1, 11);
  doc.fillColor(MUTED).fontSize(7.5);
  doc.text(note, box.x + 16, box.y, { width: box.width - 16, lineGap: 1 });
}

export function writeCertificatePage(
  doc: PDFKit.PDFDocument,
  cert: CertificateInput,
  options?: { newPage?: boolean },
) {
  const copy = pdfCopy(cert.locale);
  const tz = getSignConfig().timezone;
  const clientTimes = formatSignDateTimes(cert.clientSignedAt, tz, cert.locale);
  const providerTimes = formatSignDateTimes(
    cert.providerSignedAt,
    tz,
    cert.locale,
  );
  const logoPath = resolveSignPdfLogoPath();
  const compactLogoPath = resolveSignPdfCompactLogoPath();
  const page = doc.page;
  const margin = 42;
  const contentWidth = page.width - margin * 2;
  const bottomLimit = page.height - margin;

  if (options?.newPage !== false) {
    doc.addPage();
  }
  drawPageFrame(doc);

  let y = drawCertificateHeader(
    doc,
    { x: margin, y: margin, width: contentWidth },
    copy,
    logoPath,
  );
  y = drawMetadataBlock(
    doc,
    { x: margin, y, width: contentWidth },
    copy,
    cert,
  );

  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap) / 2;
  const clientCard: SignerCardInput = {
    heading: copy.clientHeading,
    name: cert.clientName,
    confirmed: copy.electronicallyConfirmed,
    local: clientTimes.local,
    utc: clientTimes.utc,
    verificationLabel: copy.verificationLabel,
    methods: [copy.verifyAccount, copy.verifyEmailOtp],
    withLogo: false,
    logoPath: compactLogoPath,
  };
  const providerCard: SignerCardInput = {
    heading: copy.providerHeading,
    name: cert.providerName,
    title: cert.providerTitle,
    confirmed: copy.electronicallyConfirmed,
    local: providerTimes.local,
    utc: providerTimes.utc,
    verificationLabel: copy.verificationLabel,
    methods: [copy.verifyEmployeeAccount, copy.verifyEmployeeMfa],
    withLogo: true,
    logoPath: compactLogoPath,
  };
  const cardHeight = Math.max(
    measureSignerCard(doc, cardWidth, clientCard),
    measureSignerCard(doc, cardWidth, providerCard),
  );
  drawSignerCard(
    doc,
    { x: margin, y, width: cardWidth, height: cardHeight },
    clientCard,
  );
  drawSignerCard(
    doc,
    {
      x: margin + cardWidth + cardGap,
      y,
      width: cardWidth,
      height: cardHeight,
    },
    providerCard,
  );
  y += cardHeight + 12;

  const footerNoteH = textH(doc, copy.journalNote, contentWidth - 16, 7.5) + 4;
  const integrityH = 68;
  const stampRoom = bottomLimit - footerNoteH - integrityH - y;
  const stampH = measureStamp(stampRoom);
  const stampW = 188;
  if (stampRoom >= 90) {
    drawElectronicStamp(
      doc,
      {
        x: margin + (contentWidth - stampW) / 2,
        y,
        width: stampW,
        height: stampH,
      },
      copy,
      formatStampDate(cert.providerSignedAt, cert.locale, tz),
      compactLogoPath,
    );
    y += stampH + 12;
  }

  y = drawIntegrityBlock(
    doc,
    { x: margin, y, width: contentWidth },
    copy,
    cert,
  );
  const footerY = Math.min(y, bottomLimit - footerNoteH);
  drawCertificateFooter(
    doc,
    { x: margin, y: footerY, width: contentWidth },
    copy.journalNote,
  );
}

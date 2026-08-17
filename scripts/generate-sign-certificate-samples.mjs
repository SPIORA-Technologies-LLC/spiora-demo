import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

const { buildFinalAgreementPdf } = await import(
  "../src/lib/client-portal/sign/pdf.ts"
);
const { writeCertificatePage } = await import(
  "../src/lib/client-portal/sign/pdf-certificate.ts"
);
const { resolveSignPdfFontPath } = await import(
  "../src/lib/client-portal/sign/font.ts"
);

const outDir = path.join(process.cwd(), ".data", "sign-certificate-samples");
mkdirSync(outDir, { recursive: true });

const hash =
  "10e50043f9a8a3ccc19a5e585c55c7043ee52f7257592c4c9df400aa58366fca";
const transactionId = "SP-D172F58D644D4DEE821C7A1C292DCD32";
const party = {
  firstName: "Михаил",
  lastName: "Александровский",
  patronymic: "Константинович",
  fullName: "Александровский Михаил Константинович",
  passportNumber: "AB123456",
  passportIssueDate: "15.01.2020",
  passportIssueDateIso: "2020-01-15",
  address: "Zagreb, Ilica 1",
  city: "Zagreb",
};

function certificateInput(sample) {
  return {
    agreementNumber: "SP-2026-5917249",
    versionNumber: 1,
    transactionId,
    clientName: sample.clientName,
    clientSignedAt: "2026-08-17T14:31:37.000Z",
    providerName: "Olivia Alexandra Bennett",
    providerTitle: sample.providerTitle,
    providerSignedAt: "2026-08-17T14:56:44.000Z",
    sourcePdfHash: hash,
    locale: sample.locale,
  };
}

function collectCertificate(cert) {
  const doc = new PDFDocument({
    size: "A4",
    margin: 50,
    autoFirstPage: true,
  });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.font(resolveSignPdfFontPath());
  writeCertificatePage(doc, cert, { newPage: false });
  doc.end();
  return done;
}

const samples = [
  {
    file: "certificate-ru.pdf",
    pageFile: "certificate-page-ru.pdf",
    locale: "ru",
    clientName: "Александровский Михаил Константинович",
    providerTitle: "Директор по международным консультационным услугам",
  },
  {
    file: "certificate-en.pdf",
    pageFile: "certificate-page-en.pdf",
    locale: "en",
    clientName: "Mikhail Konstantinovitch Alexandrovsky",
    providerTitle: "Director of International Consulting Services",
  },
];

for (const sample of samples) {
  const cert = certificateInput(sample);
  const bytes = await buildFinalAgreementPdf(
    {
      locale: sample.locale,
      templateVersion: "1",
      agreementNumber: "SP-2026-5917249",
      agreementDateIso: "2026-08-17",
      party,
    },
    cert,
  );
  const filePath = path.join(outDir, sample.file);
  writeFileSync(filePath, bytes);
  console.log(filePath, bytes.length);

  const pageBytes = await collectCertificate(cert);
  const pagePath = path.join(outDir, sample.pageFile);
  writeFileSync(pagePath, pageBytes);
  console.log(pagePath, pageBytes.length);
}

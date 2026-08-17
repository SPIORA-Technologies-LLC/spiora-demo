import type { AppLocale } from "@/i18n/config";

type Copy = {
  no: string;
  provider: string;
  providerHereinafter: string;
  client: string;
  ico: string;
  dic: string;
  authority: string;
  bank: string;
  passport: string;
  issued: string;
  country: string;
  postalCode: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  jointly: string;
  signatures: string;
  placeAndDate: string;
  providerRole: string;
  clientRole: string;
  namePosition: string;
  versionLabel: string;
  transactionLabel: string;
  certificateTitle: string;
  clientHeading: string;
  providerHeading: string;
  confirmedElectronically: string;
  dateTime: string;
  method: string;
  methodBody: string;
  signer: string;
  title: string;
  sourceHash: string;
  journalNote: string;
  productLabel: string;
  certificateSubtitle: string;
  bothConfirmed: string;
  electronicallyConfirmed: string;
  agreementLabel: string;
  integrityTitle: string;
  sourceHashLabel: string;
  verificationLabel: string;
  verifyAccount: string;
  verifyEmailOtp: string;
  verifyEmployeeAccount: string;
  verifyEmployeeMfa: string;
  stampConfirmed: string;
  stampElectronicDocument: string;
};

const EN: Copy = {
  no: "No.",
  provider: "PROVIDER",
  providerHereinafter: 'hereinafter referred to as the "Provider",',
  client: "CLIENT",
  ico: "Company registration number (IČO):",
  dic: "Tax identification number (DIČ):",
  authority: "Registering authority:",
  bank: "Bank account:",
  passport: "Passport:",
  issued: "Date of passport issue:",
  country: "Country:",
  postalCode: "Postal code:",
  city: "City:",
  address: "Address:",
  email: "Email:",
  phone: "Phone:",
  jointly:
    'hereinafter referred to as the "Client", jointly referred to as the "Parties", have entered into this Agreement as follows:',
  signatures: "SIGNATURES OF THE PARTIES",
  placeAndDate: "Place and date:",
  providerRole: "Poskytovateľ / Provider",
  clientRole: "Objednávateľ / Client",
  namePosition: "Name / position:",
  versionLabel: "Version",
  transactionLabel: "Transaction ID",
  certificateTitle: "ELECTRONIC SIGNING CERTIFICATE",
  clientHeading: "CLIENT",
  providerHeading: "SPIORA",
  confirmedElectronically: "The document was confirmed electronically through SPIORA.",
  dateTime: "Date/time:",
  method: "Verification method:",
  methodBody:
    "Authenticated SPIORA account + one-time code sent to the client's verified email.",
  signer: "Signer:",
  title: "Title:",
  sourceHash: "SHA-256 of the source PDF:",
  journalNote:
    "Electronic confirmation events and the technical audit trail are stored in the SPIORA information system.",
  productLabel: "SPIORA SIGN",
  certificateSubtitle: "Electronic Document Verification",
  bothConfirmed: "DOCUMENT CONFIRMED BY BOTH PARTIES",
  electronicallyConfirmed: "ELECTRONICALLY CONFIRMED",
  agreementLabel: "AGREEMENT",
  integrityTitle: "DOCUMENT INTEGRITY",
  sourceHashLabel: "SHA-256 of the source PDF",
  verificationLabel: "Verification",
  verifyAccount: "Authenticated SPIORA account",
  verifyEmailOtp: "One-time code to verified e-mail",
  verifyEmployeeAccount: "SPIORA employee account",
  verifyEmployeeMfa: "Employee MFA",
  stampConfirmed: "CONFIRMED",
  stampElectronicDocument: "ELECTRONIC DOCUMENT",
};

const RU: Copy = {
  no: "№",
  provider: "ИСПОЛНИТЕЛЬ",
  providerHereinafter: "далее именуемое «Исполнитель»,",
  client: "КЛИЕНТ",
  ico: "Регистрационный номер компании (IČO):",
  dic: "Налоговый номер (DIČ):",
  authority: "Регистрирующий орган:",
  bank: "Банковский счёт:",
  passport: "Паспорт:",
  issued: "Дата выдачи паспорта:",
  country: "Страна:",
  postalCode: "Почтовый индекс:",
  city: "Город:",
  address: "Адрес:",
  email: "Email:",
  phone: "Телефон:",
  jointly:
    "далее именуемый «Клиент», совместно именуемые «Стороны», заключили настоящий Договор о нижеследующем:",
  signatures: "ПОДПИСИ СТОРОН",
  placeAndDate: "Место и дата:",
  providerRole: "Poskytovateľ / Исполнитель",
  clientRole: "Objednávateľ / Клиент",
  namePosition: "ФИО / должность:",
  versionLabel: "Версия",
  transactionLabel: "Transaction ID",
  certificateTitle: "СВЕДЕНИЯ ОБ ЭЛЕКТРОННОМ ПОДПИСАНИИ",
  clientHeading: "КЛИЕНТ",
  providerHeading: "SPIORA",
  confirmedElectronically: "Документ подтверждён электронно через SPIORA.",
  dateTime: "Дата/время:",
  method: "Метод подтверждения:",
  methodBody:
    "Авторизованный аккаунт SPIORA + одноразовый код, направленный на подтверждённый e-mail клиента.",
  signer: "ФИО:",
  title: "Должность:",
  sourceHash: "SHA-256 source PDF:",
  journalNote:
    "Сведения о событиях электронного подтверждения и технический журнал хранятся в информационной системе SPIORA.",
  productLabel: "SPIORA SIGN",
  certificateSubtitle: "Электронное подтверждение документа",
  bothConfirmed: "ДОКУМЕНТ ПОДТВЕРЖДЁН ОБЕИМИ СТОРОНАМИ",
  electronicallyConfirmed: "ПОДТВЕРЖДЕНО ЭЛЕКТРОННО",
  agreementLabel: "ДОГОВОР",
  integrityTitle: "КОНТРОЛЬ ЦЕЛОСТНОСТИ ДОКУМЕНТА",
  sourceHashLabel: "SHA-256 исходного PDF",
  verificationLabel: "Подтверждение",
  verifyAccount: "Авторизованный аккаунт SPIORA",
  verifyEmailOtp: "Одноразовый код на подтверждённый e-mail",
  verifyEmployeeAccount: "Аккаунт сотрудника SPIORA",
  verifyEmployeeMfa: "Многофакторная аутентификация сотрудника",
  stampConfirmed: "ПОДТВЕРЖДЕНО",
  stampElectronicDocument: "ЭЛЕКТРОННЫЙ ДОКУМЕНТ",
};

export function pdfCopy(locale: AppLocale): Copy {
  return locale === "ru" ? RU : EN;
}

export function formatSignDateTimes(
  iso: string,
  timeZone: string,
  locale: AppLocale,
): { local: string; utc: string } {
  const date = new Date(iso);
  const localeTag = locale === "ru" ? "ru-RU" : "en-GB";
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  };
  const local = new Intl.DateTimeFormat(localeTag, {
    ...opts,
    timeZone,
  }).format(date);
  const utc = new Intl.DateTimeFormat("en-GB", {
    ...opts,
    timeZone: "UTC",
  }).format(date);
  return {
    local: `${local} ${timeZone}`,
    utc: `${utc} UTC`,
  };
}

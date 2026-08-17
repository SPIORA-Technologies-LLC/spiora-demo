import type { AppLocale } from "@/i18n/config";
import { countryLabel } from "./questionnaire-countries";
import { formatQuestionnaireDate } from "./questionnaire-date";
import type { QuestionnaireAnswers } from "./questionnaire-types";
import type { ConsultingAgreementSignView } from "./sign-types";

export const CONSULTING_AGREEMENT_SECTION_ID = "consulting_agreement";
export const CONSULTING_AGREEMENT_QUESTION_ID =
  "consulting_agreement_acknowledgement";
export const CONSULTING_AGREEMENT_VERSION = "2026.1";

export type ConsultingAgreementParty = {
  firstName: string;
  lastName: string;
  patronymic: string;
  fullName: string;
  passportNumber: string;
  passportIssueDate: string;
  passportIssueDateIso: string;
  country: string;
  postalCode: string;
  city: string;
  address: string;
  email: string;
  phone: string;
};

export function emptyConsultingAgreementParty(): ConsultingAgreementParty {
  return {
    firstName: "",
    lastName: "",
    patronymic: "",
    fullName: "",
    passportNumber: "",
    passportIssueDate: "",
    passportIssueDateIso: "",
    country: "",
    postalCode: "",
    city: "",
    address: "",
    email: "",
    phone: "",
  };
}

export function normalizeConsultingAgreementParty(
  party: Partial<ConsultingAgreementParty> | null | undefined,
): ConsultingAgreementParty {
  if (!party) return emptyConsultingAgreementParty();
  return {
    firstName: asTrimmed(party.firstName),
    lastName: asTrimmed(party.lastName),
    patronymic: asTrimmed(party.patronymic),
    fullName: asTrimmed(party.fullName),
    passportNumber: asTrimmed(party.passportNumber),
    passportIssueDate: asTrimmed(party.passportIssueDate),
    passportIssueDateIso: asTrimmed(party.passportIssueDateIso),
    country: asTrimmed(party.country),
    postalCode: asTrimmed(party.postalCode),
    city: asTrimmed(party.city),
    address: asTrimmed(party.address),
    email: asTrimmed(party.email),
    phone: asTrimmed(party.phone),
  };
}

export type ConsultingAgreementView = {
  locale: AppLocale;
  version: string;
  agreementNumber: string;
  agreementDate: string;
  agreementDateIso: string;
  party: ConsultingAgreementParty;
  clientAccepted: boolean;
  clientAcceptedAt: string | null;
  employeeAccepted: boolean;
  employeeAcceptedAt: string | null;
  submitted: boolean;
  sign?: ConsultingAgreementSignView | null;
};

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function formatPersonFullName(input: {
  firstName: string;
  lastName: string;
  patronymic?: string;
  locale: AppLocale;
}): string {
  const first = input.firstName.trim();
  const last = input.lastName.trim();
  const patronymic = input.patronymic?.trim() ?? "";
  if (input.locale === "ru") {
    return [last, first, patronymic].filter(Boolean).join(" ");
  }
  return [first, patronymic, last].filter(Boolean).join(" ");
}

export function isoDateToAgreementNumber(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  return `${match[1]}/${match[2]}/${match[3]}`;
}

export function todayIsoDate(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function extractConsultingAgreementParty(
  answers: QuestionnaireAnswers,
  locale: AppLocale,
  options?: { portalEmail?: string },
): ConsultingAgreementParty {
  const firstName = asTrimmed(answers.first_name);
  const lastName = asTrimmed(answers.last_name);
  const patronymic = asTrimmed(answers.patronymic);
  const passportIssueDateIso = asTrimmed(answers.passport_issue_date);
  const countryCode = asTrimmed(answers.country_of_residence);
  return {
    firstName,
    lastName,
    patronymic,
    fullName: formatPersonFullName({ firstName, lastName, patronymic, locale }),
    passportNumber: asTrimmed(answers.passport_number),
    passportIssueDateIso,
    passportIssueDate: passportIssueDateIso
      ? formatQuestionnaireDate(passportIssueDateIso, locale)
      : "",
    country: countryCode ? countryLabel(countryCode, locale) : "",
    postalCode: asTrimmed(answers.postal_code),
    city: asTrimmed(answers.city),
    address: asTrimmed(answers.address),
    email: asTrimmed(answers.email) || asTrimmed(options?.portalEmail),
    phone: asTrimmed(answers.phone),
  };
}

export function buildConsultingAgreementPreview(
  answers: QuestionnaireAnswers,
  locale: AppLocale,
  options?: {
    submittedAt?: string | null;
    clientAcceptedAt?: string | null;
    employeeAcceptedAt?: string | null;
    portalEmail?: string;
  },
): ConsultingAgreementView {
  const iso =
    (options?.submittedAt && options.submittedAt.slice(0, 10)) || todayIsoDate();
  return {
    locale,
    version: CONSULTING_AGREEMENT_VERSION,
    agreementNumber: isoDateToAgreementNumber(iso),
    agreementDateIso: iso,
    agreementDate: formatQuestionnaireDate(iso, locale),
    party: extractConsultingAgreementParty(answers, locale, {
      portalEmail: options?.portalEmail,
    }),
    clientAccepted:
      answers[CONSULTING_AGREEMENT_QUESTION_ID] === true ||
      Boolean(options?.clientAcceptedAt),
    clientAcceptedAt: options?.clientAcceptedAt ?? null,
    employeeAccepted: Boolean(options?.employeeAcceptedAt),
    employeeAcceptedAt: options?.employeeAcceptedAt ?? null,
    submitted: Boolean(options?.submittedAt),
  };
}

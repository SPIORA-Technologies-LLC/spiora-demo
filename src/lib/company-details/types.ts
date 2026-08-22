export type CompanyDetailsRecord = {
  id: string;
  companyName: string;
  tradingName: string;
  registrationNumber: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  generalEmail: string;
  financeEmail: string;
  phone: string;
  website: string;
  bankAccountHolder: string;
  bankName: string;
  iban: string;
  swiftBic: string;
  currency: string;
  isDemo: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type CompanyDetailsUpdateInput = {
  companyName: string;
  tradingName: string;
  registrationNumber: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  country: string;
  generalEmail: string;
  financeEmail: string;
  phone: string;
  website: string;
  bankAccountHolder: string;
  bankName: string;
  iban: string;
  swiftBic: string;
  currency: string;
  expectedVersion: number;
};

export type CompanyDetailsView = CompanyDetailsRecord & {
  canManage: boolean;
};

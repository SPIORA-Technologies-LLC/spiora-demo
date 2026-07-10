import type {
  Client,
  ClientDetail,
  ClientDocument,
  ClientNote,
  ClientSurvey,
} from "./types";

const MANAGER_DANIEL = "Daniel Cooper";
const MANAGER_EMMA = "Emma Wilson";
const MANAGER_LUCAS = "Lucas Martin";
const MANAGER_OLIVIA = "Olivia Bennett";

export const DEMO_CLIENTS: Client[] = [
  {
    id: "DEMO-1001",
    name: "John Carter",
    phone: "+000 000 000 001",
    email: "john.carter@example.com",
    country: "United States",
    citizenship: "US",
    direction: "Portugal",
    status: "In progress",
    manager: MANAGER_DANIEL,
    lastActivity: "28.05.2026",
    createdAt: "12.03.2026",
    passportNumber: "DEMO-P10001",
  },
  {
    id: "DEMO-1002",
    name: "Sofia Martins",
    phone: "+000 000 000 002",
    email: "sofia.martins@example.com",
    country: "Brazil",
    citizenship: "Brazil",
    direction: "Spain",
    status: "Consultation",
    manager: MANAGER_EMMA,
    lastActivity: "27.05.2026",
    createdAt: "05.04.2026",
    passportNumber: "DEMO-P10002",
  },
  {
    id: "DEMO-1003",
    name: "Anna Kowalska",
    phone: "+000 000 000 003",
    email: "anna.kowalska@example.com",
    country: "Poland",
    citizenship: "Poland",
    direction: "Croatia",
    status: "Documents",
    manager: MANAGER_LUCAS,
    lastActivity: "26.05.2026",
    createdAt: "20.05.2026",
    passportNumber: "DEMO-P10003",
  },
  {
    id: "DEMO-1004",
    name: "Marco Rossi",
    phone: "+000 000 000 004",
    email: "marco.rossi@example.com",
    country: "Italy",
    citizenship: "Italy",
    direction: "Slovakia",
    status: "New",
    manager: MANAGER_DANIEL,
    lastActivity: "25.05.2026",
    createdAt: "18.01.2026",
    passportNumber: "DEMO-P10004",
  },
  {
    id: "DEMO-1005",
    name: "Emily Brown",
    phone: "+000 000 000 005",
    email: "emily.brown@example.com",
    country: "United Kingdom",
    citizenship: "UK",
    direction: "Germany",
    status: "Completed",
    manager: MANAGER_EMMA,
    lastActivity: "20.05.2026",
    createdAt: "10.11.2025",
    passportNumber: "DEMO-P10005",
  },
  {
    id: "DEMO-1006",
    name: "Lucas Nguyen",
    phone: "+000 000 000 006",
    email: "lucas.nguyen@example.com",
    country: "Vietnam",
    citizenship: "Vietnam",
    direction: "Portugal",
    status: "In progress",
    manager: MANAGER_LUCAS,
    lastActivity: "24.05.2026",
    createdAt: "02.02.2026",
    passportNumber: "DEMO-P10006",
  },
  {
    id: "DEMO-1007",
    name: "Elena Fischer",
    phone: "+000 000 000 007",
    email: "elena.fischer@example.com",
    country: "Germany",
    citizenship: "Germany",
    direction: "Croatia",
    status: "Waiting",
    manager: MANAGER_DANIEL,
    lastActivity: "23.05.2026",
    createdAt: "14.02.2026",
    passportNumber: "DEMO-P10007",
  },
  {
    id: "DEMO-1008",
    name: "Tomáš Novák",
    phone: "+000 000 000 008",
    email: "tomas.novak@example.com",
    country: "Czech Republic",
    citizenship: "Czech Republic",
    direction: "Spain",
    status: "In progress",
    manager: MANAGER_EMMA,
    lastActivity: "22.05.2026",
    createdAt: "01.03.2026",
    passportNumber: "DEMO-P10008",
  },
  {
    id: "DEMO-1009",
    name: "Maria Santos",
    phone: "+000 000 000 009",
    email: "maria.santos@example.com",
    country: "Portugal",
    citizenship: "Portugal",
    direction: "Germany",
    status: "Consultation",
    manager: MANAGER_LUCAS,
    lastActivity: "21.05.2026",
    createdAt: "08.03.2026",
    passportNumber: "DEMO-P10009",
  },
  {
    id: "DEMO-1010",
    name: "James Wilson",
    phone: "+000 000 000 010",
    email: "james.wilson@example.com",
    country: "Canada",
    citizenship: "Canada",
    direction: "Portugal",
    status: "On hold",
    manager: MANAGER_OLIVIA,
    lastActivity: "19.05.2026",
    createdAt: "15.03.2026",
    passportNumber: "DEMO-P10010",
  },
  {
    id: "DEMO-1011",
    name: "Petra Horvat",
    phone: "+000 000 000 011",
    email: "petra.horvat@example.com",
    country: "Slovenia",
    citizenship: "Slovenia",
    direction: "Croatia",
    status: "Completed",
    manager: MANAGER_DANIEL,
    lastActivity: "15.04.2026",
    createdAt: "05.12.2025",
    passportNumber: "DEMO-P10011",
  },
  {
    id: "DEMO-1012",
    name: "Yuki Tanaka",
    phone: "+000 000 000 012",
    email: "yuki.tanaka@example.com",
    country: "Japan",
    citizenship: "Japan",
    direction: "Spain",
    status: "New",
    manager: MANAGER_EMMA,
    lastActivity: "18.05.2026",
    createdAt: "22.04.2026",
    passportNumber: "DEMO-P10012",
  },
];

const DEMO_SURVEYS: ClientSurvey[] = [
  {
    id: "SV-DEMO-1",
    clientId: "DEMO-1001",
    title: "Relocation intake form",
    filledAt: "15.03.2026",
    processingStatus: "Processed",
  },
  {
    id: "SV-DEMO-2",
    clientId: "DEMO-1002",
    title: "Financial profile",
    filledAt: "20.03.2026",
    processingStatus: "In review",
  },
];

const DEMO_DOCUMENTS: ClientDocument[] = [
  {
    id: "DOC-DEMO-1",
    clientId: "DEMO-1001",
    name: "demo_passport_scan.pdf",
    uploadedAt: "14.03.2026",
    category: "passport",
  },
  {
    id: "DOC-DEMO-2",
    clientId: "DEMO-1001",
    name: "demo_income_statement.pdf",
    uploadedAt: "18.03.2026",
    category: "income",
  },
  {
    id: "DOC-DEMO-3",
    clientId: "DEMO-1002",
    name: "demo_insurance.pdf",
    uploadedAt: "12.04.2026",
    category: "insurance",
  },
];

const demoNotesExtra: ClientNote[] = [];

export function getDemoNotes(clientId: string): ClientNote[] {
  const base = DEMO_NOTES.filter((n) => n.clientId === clientId);
  const extra = demoNotesExtra.filter((n) => n.clientId === clientId);
  return [...extra, ...base].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function appendDemoNote(
  clientId: string,
  author: string,
  text: string,
): ClientNote {
  const note: ClientNote = {
    id: `NT-${Date.now()}`,
    clientId,
    createdAt: new Date().toLocaleDateString("ru-RU"),
    author,
    text,
  };
  demoNotesExtra.unshift(note);
  return note;
}

const DEMO_NOTES: ClientNote[] = [
  {
    id: "NT-DEMO-1",
    clientId: "DEMO-1001",
    createdAt: "27.05.2026",
    author: MANAGER_DANIEL,
    text: "Intro call completed. Client prefers Portugal as primary destination.",
  },
  {
    id: "NT-DEMO-2",
    clientId: "DEMO-1002",
    createdAt: "26.05.2026",
    author: MANAGER_EMMA,
    text: "Document checklist sent for Spain consultation track.",
  },
];

export function getDemoClientDetail(id: string): ClientDetail | null {
  const client = DEMO_CLIENTS.find((c) => c.id === id);
  if (!client) return null;

  return {
    client,
    surveys: DEMO_SURVEYS.filter((s) => s.clientId === id),
    documents: DEMO_DOCUMENTS.filter((d) => d.clientId === id),
    notes: getDemoNotes(id),
    source: "demo",
  };
}

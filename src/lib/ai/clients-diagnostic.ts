import "server-only";

import { SEARCH_COLUMNS_CLIENTS } from "@/lib/ai/client-search";
import {
  getRecentClientSearches,
  type ClientSearchHistoryEntry,
} from "@/lib/ai/client-search-history";
import { listAllClients } from "@/lib/clients/store";

export type ClientTableSample = {
  rowIndex: number;
  name: string;
  details: string;
};

export type ClientsDiagnosticReport = {
  lastSyncedAt: string;
  searchColumns: {
    clients: string[];
  };
  recentSearches: ClientSearchHistoryEntry[];
  clientsTable: {
    label: string;
    count: number;
    source: string;
    spreadsheetEnv: string;
    gidEnv: string;
    samples: ClientTableSample[];
  };
};

export async function getClientsDiagnosticReport(): Promise<ClientsDiagnosticReport> {
  const syncedAt = new Date().toISOString();
  const { items, source: clientsSource } = await listAllClients();

  return {
    lastSyncedAt: syncedAt,
    searchColumns: {
      clients: [...SEARCH_COLUMNS_CLIENTS],
    },
    recentSearches: getRecentClientSearches(),
    clientsTable: {
      label: "Клиенты",
      count: items.length,
      source: clientsSource,
      spreadsheetEnv: "GOOGLE_SHEETS_SPREADSHEET_ID",
      gidEnv: "GOOGLE_SHEETS_PUBLIC_CLIENTS_GID",
      samples: items.slice(0, 3).map((client) => ({
        rowIndex: client.rowIndex ?? 0,
        name: client.name,
        details: [
          client.passportNumber && client.passportNumber !== "—"
            ? `паспорт ${client.passportNumber}`
            : null,
          client.manager && client.manager !== "—"
            ? `менеджер ${client.manager}`
            : null,
          client.status && client.status !== "—"
            ? `статус ${client.status}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    },
  };
}

/**
 * Remove fictional DEMO-* CRM clients (and related notes/documents) from Spiora Demo DB.
 * Does not print secrets or full client payloads.
 *
 * Usage:
 *   node scripts/clear-demo-clients.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // validated below
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

loadEnvLocal();

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function listDemoClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("id, external_id, full_name, is_demo")
    .or("is_demo.eq.true,external_id.like.DEMO-%");

  if (error) throw error;
  return data ?? [];
}

async function main() {
  const demoClients = await listDemoClients();
  console.log(`Found ${demoClients.length} demo client(s) to remove`);

  if (demoClients.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  const ids = demoClients.map((row) => row.id);
  const externalIds = demoClients.map((row) => row.external_id);

  const { error: docsError, count: docsCount } = await supabase
    .from("client_documents")
    .delete({ count: "exact" })
    .in("client_uuid", ids);

  if (docsError) throw docsError;
  console.log(`Deleted client_documents: ${docsCount ?? 0}`);

  const { error: notesByUuidError, count: notesByUuidCount } = await supabase
    .from("client_notes")
    .delete({ count: "exact" })
    .in("client_uuid", ids);

  if (notesByUuidError) throw notesByUuidError;
  console.log(`Deleted client_notes (by uuid): ${notesByUuidCount ?? 0}`);

  const { error: notesByLegacyError, count: notesByLegacyCount } = await supabase
    .from("client_notes")
    .delete({ count: "exact" })
    .in("client_id", externalIds);

  if (notesByLegacyError) throw notesByLegacyError;
  console.log(`Deleted client_notes (by legacy id): ${notesByLegacyCount ?? 0}`);

  const { error: clientsError, count: clientsCount } = await supabase
    .from("clients")
    .delete({ count: "exact" })
    .in("id", ids);

  if (clientsError) throw clientsError;
  console.log(`Deleted clients: ${clientsCount ?? 0}`);

  const remaining = await listDemoClients();
  if (remaining.length > 0) {
    throw new Error(`Cleanup incomplete: ${remaining.length} demo client(s) still present`);
  }

  console.log("Demo CRM clients cleared.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

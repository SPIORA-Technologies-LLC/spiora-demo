import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Finance unit tests use DemoFinanceStore unless explicitly forced to supabase.
if (!process.env.FINANCE_STORE_MODE) {
  process.env.FINANCE_STORE_MODE = "demo";
}

const loader = pathToFileURL(
  path.join(import.meta.dirname, "test-loader.mjs"),
).href;

register(loader, import.meta.url);

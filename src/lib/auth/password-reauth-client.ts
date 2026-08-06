import { createClient } from "@supabase/supabase-js";

function getAnonKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    null
  );
}

/**
 * Ephemeral Supabase client for re-checking current password.
 * Must not read/write the browser session cookie jar.
 */
export function createPasswordReauthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = getAnonKey();
  if (!url || !anonKey) {
    throw new Error("Supabase auth client is not configured");
  }

  const memory = new Map<string, string>();

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key) => memory.get(key) ?? null,
        setItem: (key, value) => {
          memory.set(key, value);
        },
        removeItem: (key) => {
          memory.delete(key);
        },
      },
    },
  });
}

export async function verifyCurrentPasswordWithEphemeralClient(input: {
  email: string;
  password: string;
}): Promise<{ ok: true } | { ok: false }> {
  const client = createPasswordReauthClient();
  const { error } = await client.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  // Discard client — never copy session into request cookies.
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  if (error) return { ok: false };
  return { ok: true };
}

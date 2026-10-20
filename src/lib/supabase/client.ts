import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  if (!client) {
    const { url, anonKey } = getSupabaseEnv();
    try {
      client = createBrowserClient(url, anonKey);
    } catch (err) {
      // A malformed env value degrades to local-only mode instead of crashing.
      console.error("[supabase] could not create client:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  return client;
}

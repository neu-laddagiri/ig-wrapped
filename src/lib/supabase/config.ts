/** Placeholder values from .env.local.example and SUPABASE_SETUP.md. */
const PLACEHOLDER_URLS = new Set([
  "your_supabase_project_url",
  "https://your-project-ref.supabase.co",
]);
const PLACEHOLDER_KEYS = new Set(["your_supabase_anon_key", "your-anon-key-here"]);

function isValidSupabaseUrl(url: string): boolean {
  if (PLACEHOLDER_URLS.has(url)) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(
    url && anonKey && !PLACEHOLDER_KEYS.has(anonKey) && isValidSupabaseUrl(url)
  );
}

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  };
}

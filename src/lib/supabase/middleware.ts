import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/config";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return supabaseResponse;
  }

  const { url, anonKey } = getSupabaseEnv();

  try {
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          // Keeps CDNs from caching responses that carry auth cookies.
          Object.entries(headers ?? {}).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    });

    await supabase.auth.getUser();
  } catch (err) {
    console.error("[supabase] session refresh skipped:", err instanceof Error ? err.name : "unknown");
    return NextResponse.next({ request });
  }

  return supabaseResponse;
}

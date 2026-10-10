import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

// Server-only singleton using the service role key: route handlers run
// server-side and there is no end-user auth system in this app yet (see the
// deviation note in CLAUDE.backend.md's checklist), so RLS is bypassed
// deliberately rather than worked around per request.
let client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.",
    );
  }
  if (!client) {
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

import { createServerClient } from "@supabase/ssr";

// Cliente con SERVICE ROLE (sin cookies → omite RLS). Solo para uso en el
// servidor (server components / route handlers), con alcance explícito.
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

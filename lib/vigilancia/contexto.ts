import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Contexto de organización para las rutas de Vigilancia. Usa el patrón del resto de
// la app: cliente con SERVICE_ROLE (omite RLS) autenticado por la cookie de sesión;
// el alcance por organización se aplica explícitamente en código (org_id).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SbAdmin = any;

export async function contextoOrg(): Promise<
  | { ok: true; sb: SbAdmin; userId: string; orgId: string }
  | { ok: false; status: number; error: string }
> {
  const cookieStore = cookies();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll: (cs: any[]) =>
          cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "No autenticado" };

  const { data: perfil } = await sb
    .from("perfiles").select("org_id").eq("id", user.id).single();
  if (!perfil?.org_id) return { ok: false, status: 403, error: "Perfil sin organización" };

  return { ok: true, sb, userId: user.id, orgId: perfil.org_id };
}

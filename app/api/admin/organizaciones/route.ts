import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ROL } from "@/lib/auth/roles";

// Cliente con SERVICE ROLE (permite auth.admin y omite RLS). Solo servidor.
function sbAdmin() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

async function exigirSuperadmin(sb: ReturnType<typeof sbAdmin>) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: perfil } = await sb.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== ROL.SUPERADMIN) return { error: "Solo el Propietario puede gestionar organizaciones", status: 403 as const };
  return { user };
}

// GET — lista de organizaciones con sus usuarios (para el panel del Propietario)
export async function GET() {
  const sb = sbAdmin();
  const guard = await exigirSuperadmin(sb);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const [{ data: orgs }, { data: perfiles }] = await Promise.all([
    sb.from("organizaciones").select("id, nombre, creado_at").order("creado_at", { ascending: false }),
    sb.from("perfiles").select("id, nombre_completo, rol, org_id, activo"),
  ]);

  const porOrg = new Map<string, { nombre_completo: string | null; rol: string; activo: boolean }[]>();
  for (const p of perfiles ?? []) {
    if (!p.org_id) continue;
    const arr = porOrg.get(p.org_id) ?? [];
    arr.push({ nombre_completo: p.nombre_completo, rol: p.rol, activo: p.activo });
    porOrg.set(p.org_id, arr);
  }

  const organizaciones = (orgs ?? []).map((o) => ({
    id: o.id,
    nombre: o.nombre,
    creado_at: o.creado_at,
    usuarios: porOrg.get(o.id) ?? [],
  }));

  return NextResponse.json({ organizaciones });
}

// POST — crear organización + invitar a su primer Coordinador por correo
export async function POST(request: NextRequest) {
  const sb = sbAdmin();
  const guard = await exigirSuperadmin(sb);
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { nombre, coordinador_email, coordinador_nombre } = (await request.json()) as {
    nombre?: string; coordinador_email?: string; coordinador_nombre?: string;
  };

  const orgNombre = (nombre ?? "").trim();
  const email = (coordinador_email ?? "").trim().toLowerCase();
  const coordNombre = (coordinador_nombre ?? "").trim();
  if (!orgNombre) return NextResponse.json({ error: "Falta el nombre de la organización" }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Correo del coordinador inválido" }, { status: 400 });

  // 1) Crear la organización
  const { data: org, error: orgErr } = await sb
    .from("organizaciones")
    .insert({ nombre: orgNombre })
    .select("id, nombre")
    .single();
  if (orgErr || !org) {
    return NextResponse.json({ error: `No se pudo crear la organización: ${orgErr?.message ?? "desconocido"}` }, { status: 500 });
  }

  // 2) Invitar al coordinador por correo (crea la cuenta en Auth y envía el email)
  const redirectTo = `${request.nextUrl.origin}/actualizar-contrasena`;
  const { data: inv, error: invErr } = await sb.auth.admin.inviteUserByEmail(email, {
    data: { nombre_completo: coordNombre || null, org_id: org.id, rol: ROL.COORDINADOR },
    redirectTo,
  });
  if (invErr || !inv?.user) {
    // Rollback de la organización si no se pudo invitar (best-effort)
    await sb.from("organizaciones").delete().eq("id", org.id);
    return NextResponse.json({ error: `No se pudo invitar al coordinador: ${invErr?.message ?? "desconocido"}` }, { status: 500 });
  }

  // 3) Asegurar la fila de perfil con org_id + rol correctos (por si un trigger la creó distinta)
  const { error: perfErr } = await sb.from("perfiles").upsert({
    id: inv.user.id,
    nombre_completo: coordNombre || email.split("@")[0],
    rol: ROL.COORDINADOR,
    org_id: org.id,
    activo: true,
  }, { onConflict: "id" });
  if (perfErr) {
    return NextResponse.json({ error: `Organización creada, pero falló el perfil del coordinador: ${perfErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, organizacion: org, coordinador: { email, nombre: coordNombre } });
}

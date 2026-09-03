import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ROL } from "@/lib/auth/roles";

// Cliente CON la sesión del usuario (cookies) — solo para identificar al llamante.
function sbUser() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: () => {} } }
  );
}

// Cliente ADMIN puro (service role, SIN cookies) — omite RLS y habilita auth.admin.
function sbAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Verifica que el llamante sea superadmin. Devuelve el cliente admin si OK.
async function guardSuperadmin() {
  const { data: { user } } = await sbUser().auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const admin = sbAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== ROL.SUPERADMIN) {
    return { error: "Solo el Propietario puede gestionar organizaciones", status: 403 as const };
  }
  return { admin };
}

// GET — lista de organizaciones con sus usuarios
export async function GET() {
  const g = await guardSuperadmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const admin = g.admin;

  const [{ data: orgs }, { data: perfiles }] = await Promise.all([
    admin.from("organizaciones").select("id, nombre, creado_at").order("creado_at", { ascending: false }),
    admin.from("perfiles").select("id, nombre_completo, rol, org_id, activo"),
  ]);

  const porOrg = new Map<string, { nombre_completo: string | null; rol: string; activo: boolean }[]>();
  for (const p of perfiles ?? []) {
    if (!p.org_id) continue;
    const arr = porOrg.get(p.org_id) ?? [];
    arr.push({ nombre_completo: p.nombre_completo, rol: p.rol, activo: p.activo });
    porOrg.set(p.org_id, arr);
  }

  const organizaciones = (orgs ?? []).map((o) => ({
    id: o.id, nombre: o.nombre, creado_at: o.creado_at, usuarios: porOrg.get(o.id) ?? [],
  }));

  return NextResponse.json({ organizaciones });
}

// POST — crear organización + invitar al primer Coordinador por correo
export async function POST(request: NextRequest) {
  const g = await guardSuperadmin();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const admin = g.admin;

  const { nombre, coordinador_email, coordinador_nombre } = (await request.json()) as {
    nombre?: string; coordinador_email?: string; coordinador_nombre?: string;
  };
  const orgNombre = (nombre ?? "").trim();
  const email = (coordinador_email ?? "").trim().toLowerCase();
  const coordNombre = (coordinador_nombre ?? "").trim();
  if (!orgNombre) return NextResponse.json({ error: "Falta el nombre de la organización" }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Correo del coordinador inválido" }, { status: 400 });

  // 1) Crear la organización (admin → omite RLS)
  const { data: org, error: orgErr } = await admin
    .from("organizaciones").insert({ nombre: orgNombre }).select("id, nombre").single();
  if (orgErr || !org) {
    return NextResponse.json({ error: `No se pudo crear la organización: ${orgErr?.message ?? "desconocido"}` }, { status: 500 });
  }

  // 2) Invitar al coordinador por correo (crea cuenta en Auth + envía email)
  const redirectTo = `${request.nextUrl.origin}/actualizar-contrasena`;
  const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre_completo: coordNombre || null, org_id: org.id, rol: ROL.COORDINADOR },
    redirectTo,
  });
  if (invErr || !inv?.user) {
    await admin.from("organizaciones").delete().eq("id", org.id); // rollback best-effort
    return NextResponse.json({ error: `No se pudo invitar al coordinador: ${invErr?.message ?? "desconocido"}` }, { status: 500 });
  }

  // 3) Asegurar el perfil con org_id + rol correctos
  const { error: perfErr } = await admin.from("perfiles").upsert({
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

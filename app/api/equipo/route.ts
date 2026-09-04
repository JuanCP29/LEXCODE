import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ROL, puedeCoordinar } from "@/lib/auth/roles";
import { generarPassword } from "@/lib/auth/password";

function sbUser() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: () => {} } }
  );
}
function sbAdmin() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

// Verifica que el llamante pueda coordinar; devuelve su perfil (org_id, rol).
async function guardCoordinador() {
  const { data: { user } } = await sbUser().auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const admin = sbAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol, org_id").eq("id", user.id).single();
  if (!perfil || !puedeCoordinar(perfil.rol)) {
    return { error: "Solo un Coordinador puede gestionar el equipo", status: 403 as const };
  }
  if (!perfil.org_id) return { error: "Tu usuario no está asociado a una organización", status: 400 as const };
  return { admin, orgId: perfil.org_id as string, callerId: user.id };
}

const ROLES_UI: Record<string, string> = {
  coordinador: "Coordinador",
  sustanciador: "Abogado sustanciador",
  admin: "Coordinador",
  abogado: "Abogado sustanciador",
  asistente: "Abogado sustanciador",
  revisor: "Abogado sustanciador",
  superadmin: "Propietario",
};

// GET — usuarios de la organización del coordinador (con su correo)
export async function GET() {
  const g = await guardCoordinador();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { admin, orgId } = g;

  const { data: perfiles } = await admin
    .from("perfiles")
    .select("id, nombre_completo, rol, activo")
    .eq("org_id", orgId);

  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailPorId = new Map<string, string>();
  for (const u of lista?.users ?? []) if (u.email) emailPorId.set(u.id, u.email);

  const usuarios = (perfiles ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre_completo,
    email: emailPorId.get(p.id) ?? null,
    rol: p.rol,
    rolLabel: ROLES_UI[p.rol] ?? p.rol,
    activo: p.activo,
  }));

  return NextResponse.json({ usuarios });
}

// POST — crear un usuario (sustanciador/coordinador) en la organización del coordinador
export async function POST(request: NextRequest) {
  const g = await guardCoordinador();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const { admin, orgId } = g;

  const { nombre, email, rol } = (await request.json()) as { nombre?: string; email?: string; rol?: string };
  const nombreLimpio = (nombre ?? "").trim();
  const emailLimpio = (email ?? "").trim().toLowerCase();
  const rolFinal = rol === ROL.COORDINADOR ? ROL.COORDINADOR : ROL.SUSTANCIADOR;
  if (!emailLimpio || !emailLimpio.includes("@")) {
    return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  }

  // Si ya existe un usuario con ese correo, resolverlo
  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existente = lista?.users?.find((u) => (u.email ?? "").toLowerCase() === emailLimpio);
  if (existente) {
    if (existente.last_sign_in_at) {
      return NextResponse.json({ error: "Ya existe una cuenta activa con ese correo." }, { status: 400 });
    }
    await admin.auth.admin.deleteUser(existente.id);
  }

  // Crear con contraseña temporal
  const tempPassword = generarPassword();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let creado: any = null, createErr: any = null;
  try {
    const r = await admin.auth.admin.createUser({
      email: emailLimpio,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nombre_completo: nombreLimpio || null, org_id: orgId, rol: rolFinal },
    });
    creado = r.data; createErr = r.error;
  } catch (e) { createErr = e; }
  if (createErr || !creado?.user) {
    const e = createErr ?? {};
    let detalle = e.message || e.code || e.name || "";
    if (!detalle) { try { detalle = JSON.stringify(e, Object.getOwnPropertyNames(e)); } catch { detalle = String(e); } }
    return NextResponse.json({ error: `No se pudo crear el usuario: ${detalle || "desconocido"}` }, { status: 400 });
  }

  const { error: perfErr } = await admin.from("perfiles").upsert({
    id: creado.user.id,
    nombre_completo: nombreLimpio || emailLimpio.split("@")[0],
    rol: rolFinal,
    org_id: orgId,
    activo: true,
  }, { onConflict: "id" });
  if (perfErr) {
    return NextResponse.json({ error: `Usuario creado, pero falló su perfil: ${perfErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    usuario: { email: emailLimpio, nombre: nombreLimpio, rol: rolFinal, password: tempPassword },
  });
}

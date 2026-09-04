import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ROL } from "@/lib/auth/roles";
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

// POST — agrega un Coordinador a una organización YA EXISTENTE.
// Sirve para dar de alta el equipo real dentro de una org creada por backfill
// (p. ej. "Collegia Abogados"), sin crear una organización nueva.
export async function POST(request: NextRequest) {
  const { data: { user } } = await sbUser().auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = sbAdmin();
  const { data: yo } = await admin.from("perfiles").select("rol").eq("id", user.id).single();
  if (yo?.rol !== ROL.SUPERADMIN) {
    return NextResponse.json({ error: "Solo el Propietario puede agregar coordinadores" }, { status: 403 });
  }

  const { org_id, email: emailRaw, nombre } = (await request.json()) as {
    org_id?: string; email?: string; nombre?: string;
  };
  const orgId = (org_id ?? "").trim();
  const email = (emailRaw ?? "").trim().toLowerCase();
  const coordNombre = (nombre ?? "").trim();
  if (!orgId) return NextResponse.json({ error: "Falta la organización" }, { status: 400 });
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Correo del coordinador inválido" }, { status: 400 });

  // Verificar que la organización exista.
  const { data: org } = await admin.from("organizaciones").select("id, nombre").eq("id", orgId).single();
  if (!org) return NextResponse.json({ error: "La organización no existe" }, { status: 404 });

  // Resolver colisión de correo antes de crear.
  const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existente = lista?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
  if (existente) {
    if (existente.last_sign_in_at) {
      return NextResponse.json({ error: "Ya existe una cuenta activa con ese correo. Usa otro." }, { status: 400 });
    }
    await admin.auth.admin.deleteUser(existente.id);
  }

  // Crear la cuenta del coordinador con contraseña temporal (activa al instante).
  const tempPassword = generarPassword();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let creado: any = null, createErr: any = null;
  try {
    const r = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { nombre_completo: coordNombre || null, org_id: org.id, rol: ROL.COORDINADOR },
    });
    creado = r.data; createErr = r.error;
  } catch (e) {
    createErr = e;
  }
  if (createErr || !creado?.user) {
    const e = createErr ?? {};
    let detalle = e.message || e.code || e.name || "";
    if (!detalle) { try { detalle = JSON.stringify(e, Object.getOwnPropertyNames(e)); } catch { detalle = String(e); } }
    return NextResponse.json({ error: `No se pudo crear el coordinador: ${detalle || "desconocido"}` }, { status: 400 });
  }

  const { error: perfErr } = await admin.from("perfiles").upsert({
    id: creado.user.id,
    nombre_completo: coordNombre || email.split("@")[0],
    rol: ROL.COORDINADOR,
    org_id: org.id,
    activo: true,
  }, { onConflict: "id" });
  if (perfErr) {
    return NextResponse.json({ error: `Cuenta creada, pero falló el perfil: ${perfErr.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    organizacion: org,
    coordinador: { email, nombre: coordNombre, password: tempPassword },
  });
}

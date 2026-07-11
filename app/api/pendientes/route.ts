import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

// GET — listar pendientes del usuario con caso + acciones
export async function GET() {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("pendientes")
    .select(`
      id, motivo, descripcion, estado, created_at, resuelto_at,
      casos (radicado, radicado_bizagi, nombre_demandante, cedula_demandante, despacho, pretension),
      acciones_pendiente (id, tipo, descripcion, created_at)
    `)
    .eq("creado_por", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pendientes: data });
}

// POST — crear pendiente + registrar primera acción opcional
export async function POST(request: NextRequest) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { caso_id, motivo, descripcion, acciones } = await request.json() as {
    caso_id: string;
    motivo: string;
    descripcion?: string;
    acciones?: { tipo: string; descripcion: string }[];
  };

  if (!caso_id || !motivo) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });

  // Verificar si ya existe un pendiente activo para este caso con el mismo motivo
  const { data: existente } = await supabase
    .from("pendientes")
    .select("id")
    .eq("caso_id", caso_id)
    .eq("motivo", motivo)
    .eq("estado", "pendiente")
    .eq("creado_por", user.id)
    .single();

  let pendienteId: string;

  if (existente) {
    pendienteId = existente.id;
  } else {
    const { data: nuevo, error } = await supabase
      .from("pendientes")
      .insert({ caso_id, motivo, descripcion, creado_por: user.id })
      .select("id")
      .single();
    if (error || !nuevo) return NextResponse.json({ error: error?.message }, { status: 500 });
    pendienteId = nuevo.id;
  }

  // Registrar acciones si vienen en el payload
  if (acciones && acciones.length > 0) {
    await supabase.from("acciones_pendiente").insert(
      acciones.map((a) => ({ pendiente_id: pendienteId, tipo: a.tipo, descripcion: a.descripcion, creado_por: user.id }))
    );
  }

  return NextResponse.json({ pendiente_id: pendienteId });
}

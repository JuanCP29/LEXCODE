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

type CasoImportado = {
  radicado: string;
  radicado_bizagi?: string | null;
  nombre_demandante: string;
  cedula_demandante?: string | null;
  despacho?: string | null;
  pretension?: string | null;
  clase_pretension?: string | null;
  jurisdiccion?: string | null;
  expediente_pensional?: string | null;
  asignado_a?: string | null;
};

// POST — importar casos a la cola (parseados en el cliente).
// Dedup por radicado: si el caso ya existe, lo marca en cola en vez de duplicar.
export async function POST(request: NextRequest) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { casos, lote, asignado_a } = await request.json() as {
    casos: CasoImportado[];
    lote?: string;
    asignado_a?: string | null;
  };

  if (!casos || casos.length === 0) {
    return NextResponse.json({ error: "No se recibieron casos" }, { status: 400 });
  }

  // Organización de quien importa → aísla los casos a su tenant (Fase 2).
  const { data: perfil } = await supabase.from("perfiles").select("org_id").eq("id", user.id).single();
  const orgId = perfil?.org_id ?? null;

  const nombreLote = lote || `Lote ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  const ahora = new Date().toISOString();

  // Radicados existentes para dedup
  const radicados = casos.map((c) => c.radicado).filter(Boolean);
  const { data: existentes } = await supabase
    .from("casos")
    .select("id, radicado")
    .in("radicado", radicados);
  const mapaExistente = new Map((existentes ?? []).map((e) => [e.radicado, e.id]));

  let creados = 0;
  let actualizados = 0;
  const nuevos: Record<string, unknown>[] = [];

  for (const c of casos) {
    // Por defecto, los casos se asignan a quien los importa (aparecen en "Mis casos").
    // Se pueden reasignar luego desde la pestaña "Todos (empresa)".
    const asignacion = c.asignado_a ?? asignado_a ?? user.id;
    if (mapaExistente.has(c.radicado)) {
      // Caso ya existe → marcarlo en cola
      await supabase
        .from("casos")
        .update({ cola_estado: "pendiente", cola_lote: nombreLote, cola_at: ahora, asignado_a: asignacion })
        .eq("id", mapaExistente.get(c.radicado));
      actualizados++;
    } else {
      nuevos.push({
        radicado: c.radicado,
        radicado_bizagi: c.radicado_bizagi ?? null,
        nombre_demandante: c.nombre_demandante,
        cedula_demandante: c.cedula_demandante ?? null,
        expediente_pensional: c.expediente_pensional ?? null,
        despacho: c.despacho ?? null,
        pretension: c.pretension ?? null,
        clase_pretension: c.clase_pretension ?? null,
        jurisdiccion: c.jurisdiccion ?? null,
        estado: "activo",
        abogado_id: asignacion ?? user.id,
        asignado_a: asignacion,
        org_id: orgId,
        cola_estado: "pendiente",
        cola_lote: nombreLote,
        cola_at: ahora,
      });
    }
  }

  // Insertar nuevos en lotes de 50
  for (let i = 0; i < nuevos.length; i += 50) {
    const chunk = nuevos.slice(i, i + 50);
    const { error } = await supabase.from("casos").insert(chunk);
    if (error) {
      console.error("importar cola insert:", error.message);
      return NextResponse.json({ error: error.message, creados, actualizados }, { status: 500 });
    }
    creados += chunk.length;
  }

  return NextResponse.json({ ok: true, creados, actualizados, lote: nombreLote });
}

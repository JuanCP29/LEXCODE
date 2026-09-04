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

  // Radicados existentes para dedup — SOLO dentro de la organización del importador
  // (así una importación no toca ni reasigna casos de otro tenant).
  const radicados = casos.map((c) => c.radicado).filter(Boolean);
  let dedupQ = supabase.from("casos").select("id, radicado").in("radicado", radicados);
  if (orgId) dedupQ = dedupQ.eq("org_id", orgId);
  const { data: existentes } = await dedupQ;
  const mapaExistente = new Map((existentes ?? []).map((e) => [e.radicado, e.id]));

  let creados = 0;
  let actualizados = 0;
  const nuevos: Record<string, unknown>[] = [];

  for (const c of casos) {
    // Regla: los casos importados entran a la BOLSA de Asignaciones SIN asignar.
    // El coordinador los reparte (o se autoasigna) luego; así NO aparecen en su
    // Reparto por el solo hecho de importarlos. Solo se asignan aquí si se indica
    // un responsable explícito (por caso o para todo el lote).
    const asignacion = c.asignado_a ?? asignado_a ?? null;
    if (mapaExistente.has(c.radicado)) {
      // Caso ya existe → marcarlo en cola. No se toca la asignación previa salvo
      // que llegue una explícita.
      const upd: Record<string, unknown> = { cola_estado: "pendiente", cola_lote: nombreLote, cola_at: ahora };
      if (asignacion) upd.asignado_a = asignacion;
      await supabase.from("casos").update(upd).eq("id", mapaExistente.get(c.radicado));
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
        abogado_id: user.id,          // creador (el importador), no responsable
        asignado_a: asignacion,       // null ⇒ sin asignar (queda en la bolsa)
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

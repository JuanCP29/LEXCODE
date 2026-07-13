import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { MATRIZ_SECCIONES } from "@/lib/ficha/matriz-secciones";

function sb() {
  const c = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => c.getAll(), setAll: (cs) => cs.forEach(({ name, value, options }) => c.set(name, value, options)) } }
  );
}

/**
 * POST — aprobar o reabrir una ficha.
 * body: { accion: 'aprobar' | 'reabrir' }
 *
 * Al aprobar:
 * 1. Valida que las secciones obligatorias (canBeNA=false) tengan contenido.
 * 2. Crea snapshot en ficha_versiones.
 * 3. estado → 'aprobada' + aprobada_por/aprobada_at.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = sb();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { accion } = await request.json() as { accion: "aprobar" | "reabrir" };

  const { data: ficha } = await supabase
    .from("fichas_conciliacion")
    .select("*")
    .eq("id", params.id)
    .eq("creado_por", user.id)
    .single();
  if (!ficha) return NextResponse.json({ error: "Ficha no encontrada" }, { status: 404 });

  if (accion === "reabrir") {
    const { error } = await supabase
      .from("fichas_conciliacion")
      .update({ estado: "en_revision", aprobada_por: null, aprobada_at: null })
      .eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, estado: "en_revision" });
  }

  // ── Validación pre-aprobación ──
  const faltantes: { seccion: number; title: string }[] = [];
  for (const m of MATRIZ_SECCIONES) {
    if (m.canBeNA) continue; // las N/A-ables no bloquean
    const contenido = (ficha as Record<string, unknown>)[m.dbColumn];
    if (!contenido || String(contenido).trim() === "") {
      faltantes.push({ seccion: m.sectionNumber, title: m.title });
    }
  }
  if (faltantes.length > 0) {
    return NextResponse.json(
      {
        error: "La ficha tiene secciones obligatorias sin contenido",
        faltantes,
      },
      { status: 422 }
    );
  }

  // ── Snapshot de versión (best-effort) ──
  const versionNueva = ((ficha.version_actual as number) ?? 1) + 1;
  try {
    const secciones: Record<string, string | null> = {};
    for (const m of MATRIZ_SECCIONES) {
      secciones[m.dbColumn] = (ficha as Record<string, string | null>)[m.dbColumn] ?? null;
    }
    await supabase.from("ficha_versiones").insert({
      ficha_id: params.id,
      version: versionNueva,
      secciones,
      parametros: {
        tipo_conciliacion: ficha.tipo_conciliacion,
        conciliable: ficha.conciliable,
        directriz_conciliacion: ficha.directriz_conciliacion,
        cuantia_tipo: ficha.cuantia_tipo,
        cuantia_valor: ficha.cuantia_valor,
        caducidad: ficha.caducidad,
        fecha_diligencia: ficha.fecha_diligencia,
      },
      motivo: "aprobacion",
      creado_por: user.id,
    });
  } catch (e) {
    console.error("ficha_versiones (no bloqueante):", e);
  }

  // ── Aprobar ──
  const { error } = await supabase
    .from("fichas_conciliacion")
    .update({
      estado: "aprobada",
      aprobada_por: user.id,
      aprobada_at: new Date().toISOString(),
      version_actual: versionNueva,
    })
    .eq("id", params.id);

  if (error) {
    // Compatibilidad: si las columnas nuevas no existen aún, aprobar con estado legacy
    const { error: err2 } = await supabase
      .from("fichas_conciliacion")
      .update({ estado: "listo" })
      .eq("id", params.id);
    if (err2) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, estado: "listo", advertencia: "Migración fase1 pendiente: se usó estado 'listo'." });
  }

  return NextResponse.json({ ok: true, estado: "aprobada", version: versionNueva });
}

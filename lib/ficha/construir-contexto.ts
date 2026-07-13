/**
 * Ensambla el contexto de generación de una ficha a partir de fuentes
 * controladas y trazables. Cada fuente queda identificada con su id
 * para registrarse en ficha_seccion_fuentes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validarInsumos,
  type InsumosDisponibles,
  type ValidacionSeccion,
} from "@/lib/ficha/matriz-secciones";

export type FuenteTraslado = {
  documento_id: string;
  nombre_archivo: string;
  texto: string;
};

export type FuenteActo = {
  acto_id: string;
  documento_id: string | null;
  numero_acto: string | null;
  fecha_acto: string | null;
  tipo_acto: string | null;
  sentido_decision: string | null;
  prestacion: string | null;
  semanas_reconocidas: number | null;
  tasa_aplicada: number | null;
  ingreso_base: number | null;
  resumen: string | null;
};

export type FuenteDirectriz = {
  directriz_id: string;
  nombre: string;
  codigo: string | null;
  texto: string;
  metodo: "tipologia" | "pretension";
};

export type ContextoFicha = {
  traslado: FuenteTraslado | null;
  actos: FuenteActo[];
  directriz: FuenteDirectriz | null;
  tieneTipologia: boolean;
  tienePerfil: boolean;
  nombreAbogado: string | null;
  validacion: ValidacionSeccion[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function construirContexto(
  supabase: SupabaseClient,
  casoId: string,
  userId: string,
  // parámetros del formulario con valor no nulo (nombres de campo)
  paramsPresentes: string[]
): Promise<ContextoFicha> {
  // ── 1. Traslado de la demanda (documentos_caso; fallback legacy archivos_proceso)
  let traslado: FuenteTraslado | null = null;

  const { data: docTraslado } = await supabase
    .from("documentos_caso")
    .select("id, nombre_archivo, texto_extraido")
    .eq("caso_id", casoId)
    .eq("tipo_documento", "traslado_demanda")
    .eq("estado_procesamiento", "ok")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (docTraslado?.texto_extraido) {
    traslado = {
      documento_id: docTraslado.id,
      nombre_archivo: docTraslado.nombre_archivo,
      texto: docTraslado.texto_extraido,
    };
  }

  // ── 2. Actos administrativos estructurados
  const { data: actosRows } = await supabase
    .from("actos_administrativos")
    .select("id, documento_id, numero_acto, fecha_acto, tipo_acto, sentido_decision, prestacion, semanas_reconocidas, tasa_aplicada, ingreso_base, resumen")
    .eq("caso_id", casoId)
    .order("fecha_acto", { ascending: false });

  const actos: FuenteActo[] = (actosRows ?? []).map((a) => ({
    acto_id: a.id,
    documento_id: a.documento_id,
    numero_acto: a.numero_acto,
    fecha_acto: a.fecha_acto,
    tipo_acto: a.tipo_acto,
    sentido_decision: a.sentido_decision,
    prestacion: a.prestacion,
    semanas_reconocidas: a.semanas_reconocidas,
    tasa_aplicada: a.tasa_aplicada,
    ingreso_base: a.ingreso_base,
    resumen: a.resumen,
  }));

  // ── 3. Directriz aplicable (cascada tipología → pretensión)
  const { data: caso } = await supabase
    .from("casos")
    .select("pretension, clase_pretension, tipologia_id, tipologias(parent_id)")
    .eq("id", casoId)
    .single();

  let directriz: FuenteDirectriz | null = null;
  const tieneTipologia = !!caso?.tipologia_id;

  if (caso?.tipologia_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parentId = (caso.tipologias as any)?.parent_id as string | null;
    const ids = parentId ? [caso.tipologia_id, parentId] : [caso.tipologia_id];

    const { data: rels } = await supabase
      .from("directriz_tipologias")
      .select("directriz_id")
      .in("tipologia_id", ids);

    const directrizIds = Array.from(new Set((rels ?? []).map((r) => r.directriz_id)));
    if (directrizIds.length > 0) {
      const { data: d } = await supabase
        .from("directrices_conciliacion")
        .select("id, nombre, codigo, texto_extraido")
        .in("id", directrizIds)
        .eq("activo", true)
        .order("nombre")
        .limit(1)
        .maybeSingle();
      if (d?.texto_extraido) {
        directriz = {
          directriz_id: d.id,
          nombre: d.nombre,
          codigo: d.codigo,
          texto: d.texto_extraido,
          metodo: "tipologia",
        };
      }
    }
  }

  // Fallback por pretensión (comportamiento previo, no se rompe)
  if (!directriz && caso?.pretension) {
    const { data: rows } = await supabase
      .from("directrices_conciliacion")
      .select("id, nombre, codigo, texto_extraido, clase_pretension")
      .eq("activo", true)
      .or(`pretension.eq.${caso.pretension},pretension.eq.general`)
      .order("pretension")
      .limit(3);

    if (rows && rows.length > 0) {
      const porClase = caso.clase_pretension
        ? rows.find((r) => r.clase_pretension === caso.clase_pretension)
        : null;
      const d = porClase ?? rows[0];
      if (d.texto_extraido) {
        directriz = {
          directriz_id: d.id,
          nombre: d.nombre,
          codigo: d.codigo,
          texto: d.texto_extraido,
          metodo: "pretension",
        };
      }
    }
  }

  // ── 4. Perfil del abogado (para sección 19)
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo")
    .eq("id", userId)
    .single();

  const tienePerfil = !!perfil?.nombre_completo;

  // ── 5. Validación contra la matriz
  const insumos: InsumosDisponibles = {
    documentos: traslado ? ["traslado_demanda"] : [],
    tieneTipologia,
    tieneDirectriz: !!directriz,
    params: paramsPresentes,
    tienePerfil,
  };

  return {
    traslado,
    actos,
    directriz,
    tieneTipologia,
    tienePerfil,
    nombreAbogado: perfil?.nombre_completo ?? null,
    validacion: validarInsumos(insumos),
  };
}

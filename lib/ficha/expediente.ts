/**
 * Ensambla el expediente COMPLETO de un caso para alimentar la generación de
 * Consideraciones: reúne el texto de todos los documentos procesados (traslado,
 * resoluciones/actos, historia laboral, anexos) más el resumen estructurado de
 * actos administrativos. Antes solo entraba `casos.texto_expediente` (una fuente).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const ORDEN: Record<string, number> = {
  traslado_demanda: 0,
  acto_administrativo: 1,
  historia_laboral: 2,
  anexo: 3,
};
const ETIQUETA: Record<string, string> = {
  traslado_demanda: "TRASLADO DE LA DEMANDA",
  acto_administrativo: "ACTO ADMINISTRATIVO (RESOLUCIÓN SUB/SUBA/DPE/DIR)",
  historia_laboral: "HISTORIA LABORAL",
  anexo: "ANEXO",
};

const PER_DOC = 30000; // tope por documento
const TOTAL = 120000; // tope global del expediente en el prompt

export async function armarExpedienteConsideraciones(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  casoId: string,
  fallbackTexto = ""
): Promise<string> {
  const { data: docs } = await supabase
    .from("documentos_caso")
    .select("tipo_documento, nombre_archivo, texto_extraido, estado_procesamiento")
    .eq("caso_id", casoId)
    .eq("estado_procesamiento", "ok");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const utiles = ((docs ?? []) as any[]).filter((d) => (d.texto_extraido ?? "").trim().length > 40);

  const { data: actos } = await supabase
    .from("actos_administrativos")
    .select("numero_acto, fecha_acto, tipo_acto, sentido_decision, prestacion, semanas_reconocidas, tasa_aplicada, ingreso_base, resumen")
    .eq("caso_id", casoId)
    .order("fecha_acto", { ascending: true });

  const partes: string[] = [];

  if (utiles.length > 0) {
    utiles.sort((a, b) => (ORDEN[a.tipo_documento] ?? 9) - (ORDEN[b.tipo_documento] ?? 9));
    for (const d of utiles) {
      const etiqueta = ETIQUETA[d.tipo_documento] ?? String(d.tipo_documento).toUpperCase();
      partes.push(`### ${etiqueta} — ${d.nombre_archivo}\n${(d.texto_extraido ?? "").slice(0, PER_DOC)}`);
    }
  } else if (fallbackTexto.trim()) {
    // Compatibilidad: casos antiguos sin documentos_caso procesados.
    partes.push(`### EXPEDIENTE\n${fallbackTexto}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (actos && (actos as any[]).length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resumen = (actos as any[])
      .map(
        (a) =>
          `- Acto ${a.numero_acto ?? "s/n"} (${a.fecha_acto ?? "s/f"}) [${a.tipo_acto ?? "otro"}]: ${a.sentido_decision ?? ""}. ` +
          `Prestación: ${a.prestacion ?? "—"}. Semanas: ${a.semanas_reconocidas ?? "—"}. Tasa: ${a.tasa_aplicada ?? "—"}%. IBL: ${a.ingreso_base ?? "—"}. ${a.resumen ?? ""}`
      )
      .join("\n");
    partes.push(`### RESUMEN ESTRUCTURADO DE ACTOS ADMINISTRATIVOS\n${resumen}`);
  }

  return partes.join("\n\n").slice(0, TOTAL);
}

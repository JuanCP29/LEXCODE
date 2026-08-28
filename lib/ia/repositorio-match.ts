import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Emparejador de repositorio (Fase 3) — fuente ÚNICA para cruzar el texto de un
 * caso (resoluciones/oficios o el bloque de jurisprudencia de la sección 4) con
 * los documentos del repositorio (directriz/memorando/lineamiento/otro).
 *
 * Lo usan la sección 9 (jurisprudencia) y la sección 16 (consideraciones) para
 * robustecer su análisis SOLO con coincidencias reales.
 */

/** Extrae identificadores de sentencias/radicados del texto (SL, C/T/SU, radicación). */
export function extraerIdentificadoresSentencias(texto: string): string[] {
  if (!texto) return [];
  const ids = new Set<string>();
  // Corte Suprema Sala Laboral: SL1234-2022, SL 1234 de 2022
  Array.from(texto.matchAll(/\bSL\s?-?\s?(\d{2,5})\s?(?:-|de\s+)?\s?(\d{4})\b/gi)).forEach((m) => {
    ids.add(`SL${m[1]}-${m[2]}`);
  });
  // Corte Constitucional: C-258/13, T-020/2015, SU-230 de 2015
  Array.from(texto.matchAll(/\b(C|T|SU)\s?-\s?(\d{1,4})\s?(?:\/|de\s+)?\s?(\d{2,4})\b/gi)).forEach((m) => {
    ids.add(`${m[1].toUpperCase()}-${m[2]}/${m[3]}`);
  });
  // Radicación numérica (Consejo de Estado / CSJ): "radicación No 92207"
  Array.from(texto.matchAll(/radicaci[oó]n\s*(?:n[o°.]*\s*)?([\d][\d.\-]{3,})/gi)).forEach((m) => {
    ids.add(m[1].replace(/[.\s]/g, ""));
  });
  return Array.from(ids).slice(0, 8);
}

export const soloAlnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type DocRepo = {
  nombre: string;
  codigo: string | null;
  tipo_documento: string | null;
  texto_extraido: string | null;
};

const TIPO_LABEL: Record<string, string> = {
  directriz: "Directriz", memorando: "Memorando", lineamiento: "Lineamiento", otro: "Documento",
};

/**
 * Devuelve los documentos activos del repositorio que COINCIDEN con `texto`,
 * de forma bidireccional: (a) un identificador citado en el texto aparece en el
 * nombre/código/contenido del documento, o (b) un identificador del nombre/código
 * del documento aparece en el texto. Acota a `limite` documentos.
 */
export async function buscarCoincidenciasRepositorio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", any>,
  texto: string,
  limite = 3
): Promise<DocRepo[]> {
  const { data } = await supabase
    .from("directrices_conciliacion")
    .select("nombre, codigo, tipo_documento, texto_extraido")
    .eq("activo", true);

  const heno = soloAlnum(texto);
  const idsTexto = extraerIdentificadoresSentencias(texto).map(soloAlnum);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[])
    .filter((d) => {
      const henoNombre = soloAlnum(`${d.nombre ?? ""} ${d.codigo ?? ""}`);
      const henoTextoDoc = soloAlnum(d.texto_extraido ?? "");
      const idsDoc = [d.codigo ?? "", ...extraerIdentificadoresSentencias(`${d.nombre ?? ""}`)].map(soloAlnum);
      return (
        idsTexto.some((id) => id.length >= 4 && (henoNombre.includes(id) || henoTextoDoc.includes(id))) ||
        idsDoc.some((id) => id.length >= 4 && heno.includes(id))
      );
    })
    .slice(0, limite);
}

/** Formatea los documentos coincidentes como bloques "### Tipo (código — nombre)\n<texto>". */
export function construirFuentesRepositorio(docs: DocRepo[], maxChars = 8000): string {
  return docs
    .map((d) => {
      const etiqueta = TIPO_LABEL[d.tipo_documento ?? "directriz"] ?? "Documento";
      const cod = d.codigo ? `${d.codigo} — ` : "";
      return `### ${etiqueta} (${cod}${d.nombre})\n${(d.texto_extraido ?? "").slice(0, maxChars)}`;
    })
    .join("\n\n");
}

/**
 * Constructor de prompt v2 — generación con fuentes controladas.
 *
 * Reglas:
 * - Cada sección solo puede usar las fuentes autorizadas por la matriz.
 * - Si la fuente primaria no está disponible y la sección admite N/A,
 *   se resuelve como "N/A" SIN llamar a la IA.
 * - Si no está disponible y NO admite N/A, la sección queda vacía y se
 *   registra advertencia — la IA nunca inventa.
 */
import { MATRIZ_SECCIONES, type FichaSectionMapping } from "@/lib/ficha/matriz-secciones";
import type { ContextoFicha } from "@/lib/ficha/construir-contexto";

export const PROMPT_VERSION = "v2.0";

export type ParametrosFichaV2 = {
  tipo_conciliacion: string;
  conciliable: boolean;
  directriz_conciliacion: string;
  resolucion_prestacion: string;
  semanas_cotizadas: number | null;
  tasa_aplicada: number | null;
  tasa_solicitada: number | null;
  cuantia_tipo: string;
  cuantia_valor: number | null;
  pretende_intereses: boolean;
  pretende_indexacion: boolean;
  hay_fallo: boolean;
  sintesis_fallo: string;
  caducidad?: string | null;
  fecha_diligencia?: string | null;
};

export type CasoDatos = {
  radicado: string;
  nombre_demandante: string;
  pretension: string | null;
  clase_pretension: string | null;
  jurisdiccion: string | null;
};

export type PlanSeccion = {
  mapping: FichaSectionMapping;
  accion: "generar" | "na" | "vacia" | "directa";
  /** Para acción 'directa' (sec 19): el contenido ya resuelto */
  contenidoDirecto?: string;
  advertencia?: string;
};

/**
 * Decide qué hacer con cada sección según insumos disponibles.
 */
export function planificarSecciones(
  contexto: ContextoFicha,
  params: ParametrosFichaV2
): PlanSeccion[] {
  return MATRIZ_SECCIONES.map((mapping) => {
    const val = contexto.validacion.find((v) => v.sectionNumber === mapping.sectionNumber)!;

    // Sección 19: directa desde el perfil, sin IA
    if (mapping.sectionNumber === 19) {
      return {
        mapping,
        accion: "directa" as const,
        contenidoDirecto: contexto.nombreAbogado ?? "",
        advertencia: contexto.nombreAbogado ? undefined : "Perfil sin nombre completo — diligenciar manualmente.",
      };
    }

    // Sección 13: siempre manual (sin IA)
    if (!mapping.requiresAI) {
      return { mapping, accion: "na" as const };
    }

    // Sección 6: si no hay fallo, texto por defecto N/A
    if (mapping.sectionNumber === 6 && !params.hay_fallo) {
      return { mapping, accion: "na" as const };
    }
    // Sección 9: si caducidad = NO APLICA, N/A
    if (mapping.sectionNumber === 9 && (params.caducidad === "NO APLICA" || !params.caducidad)) {
      return { mapping, accion: "na" as const };
    }

    if (val.generable) return { mapping, accion: "generar" as const };
    if (val.resolverComoNA) {
      return {
        mapping,
        accion: "na" as const,
        advertencia: `Sin insumos (${val.faltantes.join(", ")}) — resuelta como N/A.`,
      };
    }
    return {
      mapping,
      accion: "vacia" as const,
      advertencia: `Insumos faltantes: ${val.faltantes.join(", ")}. La sección requiere diligenciamiento manual o cargar los documentos.`,
    };
  });
}

const NOMBRE_FUENTE: Record<string, string> = {
  excel_csv: "DATOS DE LA BASE",
  traslado_demanda: "TRASLADO DE LA DEMANDA",
  acto_administrativo: "ACTOS ADMINISTRATIVOS",
  directriz_colpensiones: "DIRECTRIZ COLPENSIONES",
  manual: "PARÁMETROS DEL ABOGADO",
  mixta: "FUENTES COMBINADAS",
};

export function construirPromptV2(
  caso: CasoDatos,
  params: ParametrosFichaV2,
  contexto: ContextoFicha,
  plan: PlanSeccion[]
): string {
  const aGenerar = plan.filter((p) => p.accion === "generar");
  if (aGenerar.length === 0) return "";

  const cuantia =
    params.cuantia_tipo === "determinada" && params.cuantia_valor
      ? `Determinada — $${params.cuantia_valor.toLocaleString("es-CO")}`
      : "Indeterminada (art. 20 C.G.P.)";

  // ── Bloques de fuentes disponibles ──
  const bloques: string[] = [];

  bloques.push(`### PARÁMETROS DEL ABOGADO (fuente: manual)
- Radicado: ${caso.radicado}
- Demandante: ${caso.nombre_demandante}
- Pretensión: ${caso.pretension ?? "No especificada"} ${caso.clase_pretension ? `— ${caso.clase_pretension}` : ""}
- Jurisdicción: ${caso.jurisdiccion ?? "No especificada"}
- Resolución de prestación: ${params.resolucion_prestacion || "No aplica"}
- Semanas cotizadas: ${params.semanas_cotizadas ?? "No especificadas"}
- Tasa aplicada: ${params.tasa_aplicada != null ? `${params.tasa_aplicada}%` : "No aplica"}
- Tasa solicitada: ${params.tasa_solicitada != null ? `${params.tasa_solicitada}%` : "No aplica"}
- Cuantía: ${cuantia}
- Intereses moratorios: ${params.pretende_intereses ? "Sí" : "No"}
- Indexación: ${params.pretende_indexacion ? "Sí" : "No"}
- Tipo de conciliación: ${params.tipo_conciliacion}
- Conciliable según el abogado: ${params.conciliable ? "Sí" : "No"}
- Caducidad: ${params.caducidad ?? "No especificada"}
- Hay fallo de primera instancia: ${params.hay_fallo ? "Sí" : "No"}${params.hay_fallo && params.sintesis_fallo ? `\n- Síntesis del fallo (aportada por el abogado): ${params.sintesis_fallo}` : ""}`);

  if (contexto.traslado) {
    bloques.push(`### TRASLADO DE LA DEMANDA (fuente: documento "${contexto.traslado.nombre_archivo}")
${contexto.traslado.texto.slice(0, 40000)}`);
  }

  if (contexto.actos.length > 0) {
    const actosTexto = contexto.actos
      .map(
        (a) =>
          `- Acto ${a.numero_acto ?? "s/n"} (${a.fecha_acto ?? "sin fecha"}) [${a.tipo_acto ?? "otro"}]: ${a.sentido_decision ?? ""}. Prestación: ${a.prestacion ?? "—"}. Semanas: ${a.semanas_reconocidas ?? "—"}. Tasa: ${a.tasa_aplicada ?? "—"}%. IBL: ${a.ingreso_base ?? "—"}.\n  Resumen: ${a.resumen ?? "—"}`
      )
      .join("\n");
    bloques.push(`### ACTOS ADMINISTRATIVOS (fuente: extracción estructurada de documentos cargados)
${actosTexto}`);
  }

  if (contexto.directriz) {
    bloques.push(`### DIRECTRIZ COLPENSIONES (fuente: ${contexto.directriz.codigo ? `${contexto.directriz.codigo} — ` : ""}"${contexto.directriz.nombre}")
${contexto.directriz.texto.slice(0, 25000)}`);
  }

  // ── Instrucciones por sección ──
  const instrucciones = aGenerar
    .map((p) => {
      const m = p.mapping;
      const fuentes = [m.primarySource, ...m.secondarySources]
        .map((f) => NOMBRE_FUENTE[f])
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(" y ");
      return `- "sec_${m.sectionNumber}" — ${m.title}:
  Fuentes AUTORIZADAS: ${fuentes}. Usa EXCLUSIVAMENTE esas fuentes.
  Si la información necesaria no aparece en esas fuentes, escribe "N/A" — NO uses conocimiento general ni otras fuentes del contexto.`;
    })
    .join("\n");

  return `Eres un abogado experto en derecho laboral y seguridad social colombiana que diligencia
la Ficha Técnica de Conciliación Judicial formato GDJ-GPO-FMT-005 v2 de Colpensiones.

REGLAS ESTRICTAS DE TRAZABILIDAD:
1. Cada sección tiene fuentes AUTORIZADAS. Solo puedes usar información de esas fuentes.
2. NUNCA inventes hechos, fechas, cifras, normas ni jurisprudencia.
3. Si citas una norma o sentencia, debe aparecer textualmente en las fuentes autorizadas de esa sección.
4. Si la fuente autorizada no contiene la información, la sección se responde "N/A".
5. Lenguaje jurídico formal colombiano, redacción institucional.

═══════════ FUENTES DISPONIBLES ═══════════

${bloques.join("\n\n")}

═══════════ SECCIONES A GENERAR ═══════════

${instrucciones}

Responde ÚNICAMENTE con un objeto JSON válido cuyas claves sean exactamente ${aGenerar.map((p) => `"sec_${p.mapping.sectionNumber}"`).join(", ")} y cuyos valores sean el texto de cada sección.`;
}

/** Parsea la respuesta y mapea a columnas de BD según la matriz */
export function parsearRespuestaV2(
  respuesta: string,
  plan: PlanSeccion[]
): Record<string, string> {
  const match = respuesta.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("La IA no devolvió JSON válido.");
  const json = JSON.parse(match[0]) as Record<string, unknown>;

  const resultado: Record<string, string> = {};
  for (const p of plan) {
    const col = p.mapping.dbColumn;
    if (p.accion === "generar") {
      const valor = json[`sec_${p.mapping.sectionNumber}`];
      if (valor != null) resultado[col] = String(valor);
    } else if (p.accion === "na") {
      resultado[col] = "N/A";
    } else if (p.accion === "directa") {
      resultado[col] = p.contenidoDirecto ?? "";
    }
    // 'vacia' → no se escribe: queda null para diligenciamiento manual
  }
  return resultado;
}

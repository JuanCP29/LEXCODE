import { type Caso } from "@/lib/types";
import { SECCIONES } from "@/lib/ia/secciones";

// Secciones AUTO: IA genera contenido
export const SECCIONES_AUTO = SECCIONES.filter((s) => s.tipo === "AUTO").map((s) => s.numero);

// Secciones DEFAULT: texto predefinido por condición
export const SECCIONES_DEFAULT = SECCIONES.filter((s) => s.tipo === "DEFAULT").map((s) => s.numero);

// Secciones MANUAL: el abogado diligencia
export const SECCIONES_MANUALES = SECCIONES.filter((s) => s.tipo === "MANUAL").map((s) => s.numero);

export interface ParametrosFicha {
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
}

export function construirPrompt(
  caso: Pick<Caso, "radicado" | "nombre_demandante" | "pretension" | "clase_pretension" | "jurisdiccion">,
  params: ParametrosFicha,
  textoDemanda: string,
  lineamientos: string
): string {
  const cuantia = params.cuantia_tipo === "determinada" && params.cuantia_valor
    ? `Determinada — $${params.cuantia_valor.toLocaleString("es-CO")}`
    : "Indeterminada";

  // Solo pedimos las secciones AUTO: 1, 2, 3, 4, 8, 16, 18
  return `Eres un abogado experto en seguridad social colombiana.
Analiza la siguiente demanda y genera las secciones de la Ficha de Conciliación Judicial
formato GDJ-GPO-FMT-005 para Colpensiones.

PARÁMETROS DEL CASO:
- Radicado: ${caso.radicado}
- Demandante: ${caso.nombre_demandante}
- Pretensión: ${caso.pretension ?? "No especificada"}
- Clase: ${caso.clase_pretension ?? "No especificada"}
- Jurisdicción: ${caso.jurisdiccion ?? "No especificada"}
- Resolución de prestación: ${params.resolucion_prestacion || "No aplica"}
- Semanas cotizadas: ${params.semanas_cotizadas ?? "No especificadas"}
- Tasa aplicada: ${params.tasa_aplicada != null ? `${params.tasa_aplicada}%` : "No aplica"}
- Tasa solicitada: ${params.tasa_solicitada != null ? `${params.tasa_solicitada}%` : "No aplica"}
- Cuantía: ${cuantia}
- Intereses moratorios: ${params.pretende_intereses ? "Sí" : "No"}
- Indexación: ${params.pretende_indexacion ? "Sí" : "No"}
- Tipo de conciliación: ${params.tipo_conciliacion}
- Conciliable: ${params.conciliable ? "Sí" : "No"}
- Directriz: ${params.directriz_conciliacion || "No especificada"}
- Hay fallo de segunda instancia: ${params.hay_fallo ? "Sí" : "No"}
${params.hay_fallo && params.sintesis_fallo ? `- Síntesis del fallo: ${params.sintesis_fallo}` : ""}

TEXTO DE LA DEMANDA:
${textoDemanda || "No se proporcionó texto de demanda."}

DIRECTRIZ / LINEAMIENTOS DE CONCILIACIÓN:
${lineamientos || "No se proporcionaron directrices ni lineamientos."}

Genera ÚNICAMENTE las secciones AUTO: 1, 2, 3, 4, 8, 16 y 18.
Las secciones 5, 6, 9, 13, 14, 15 y 17 tienen texto predefinido (DEFAULT).
Las secciones 7, 10, 11, 12 y 19 son de diligenciamiento manual (MANUAL).

Responde ÚNICAMENTE en JSON válido con esta estructura exacta:
{
  "sec_1": "...",
  "sec_2": "...",
  "sec_3": "...",
  "sec_4": "...",
  "sec_8": "...",
  "sec_16": "...",
  "sec_18": "..."
}

Usa lenguaje jurídico formal colombiano. No inventes datos que no estén en los insumos.`;
}

// Mapeo clave JSON → nombre columna BD
const MAPA_SECCIONES: Record<string, string> = {
  sec_1:  "sec_1_hechos",
  sec_2:  "sec_2_pretensiones",
  sec_3:  "sec_3_cuantia",
  sec_4:  "sec_4_normas",
  sec_8:  "sec_8_problema",
  sec_16: "sec_16_consideraciones",
  sec_18: "sec_18_recomendacion",
};

export function parsearRespuestaIA(respuesta: string): Partial<Record<string, string>> {
  const match = respuesta.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("La IA no devolvió JSON válido.");

  const json = JSON.parse(match[0]);
  const resultado: Partial<Record<string, string>> = {};

  for (const [clave, valor] of Object.entries(json)) {
    const nombreCampo = MAPA_SECCIONES[clave];
    if (nombreCampo) resultado[nombreCampo] = String(valor);
  }

  return resultado;
}

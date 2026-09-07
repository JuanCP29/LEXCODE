/**
 * Método CONSIDERACIONES — instrucción especializada para la sección más importante
 * de la Ficha de Conciliación (columna `sec_16_consideraciones`).
 *
 * Es el "cerebro" del análisis: argumenta ante el Comité por qué el asunto NO es
 * conciliable y alimenta las "razones de la defensa" de la Contestación.
 *
 * Codifica el patrón extraído de 5 fichas oro (ver docs/consideraciones-metodo.md):
 * anatomía de 9 pasos, postura según el rol de Colpensiones, jerarquía de los actos
 * administrativos, bloque de pretensiones accesorias y reglas estrictas de trazabilidad.
 *
 * Este archivo NO llama al modelo; exporta fragmentos de prompt que consume el
 * generador (llamada dedicada a Consideraciones o el constructor de la ficha).
 */

import { EJEMPLOS_CONSIDERACIONES } from "@/lib/ficha/consideraciones-fewshot";

/** Postura de Colpensiones en el proceso, que fija el tono del análisis. */
export type PosturaColpensiones =
  | "negacion" // Colpensiones negó la prestación (tono concluyente: "no cumple requisitos")
  | "pasiva"; //  Colpensiones es demandada pasiva / la falta se imputa a un tercero (AFP): tono defensivo y matizado

/** Jerarquía de los actos administrativos de Colpensiones (para interpretar el expediente). */
export const JERARQUIA_ACTOS = `ACTOS ADMINISTRATIVOS DE COLPENSIONES (interpreta los prefijos de las resoluciones):
- SUB / (antes GNR): Subdirección de Prestaciones Económicas. Reconoce prestaciones y resuelve RECURSOS DE REPOSICIÓN.
- SUBA: variante de la Subdirección; es un REQUERIMIENTO de prueba o documento al ciudadano (no decide de fondo).
- DPE / DIR / (antes VPB): Dirección de Prestaciones Económicas (superior). Resuelve RECURSOS DE APELACIÓN.
La resolución que NIEGA de forma definitiva (típicamente la última en la cadena reposición -> apelación) es el ANCLA:
su motivación es el punto de partida del análisis. Cita el número y la fecha de cada acto tal como aparecen.`;

/** Método de razonamiento (anatomía de 9 pasos). Núcleo del análisis, común a toda pretensión. */
export const METODO_CONSIDERACIONES = `Redacta la sección CONSIDERACIONES de la Ficha de Conciliación de COLPENSIONES.
Es la defensa jurídica de la entidad: debe sustentar por qué la actuación de Colpensiones se ajustó a derecho y,
como consecuencia, por qué el asunto NO es susceptible de conciliación.

Sigue este MÉTODO (adáptalo a la pretensión; omite un paso solo si no hay fuente para él, sin inventar):
1. DELIMITACIÓN: enuncia qué se pide, en qué calidad y el problema jurídico concreto.
2. ANTECEDENTES ADMINISTRATIVOS: relata las resoluciones (SUB/SUBA/DPE/DIR/GNR/VPB) y radicados; qué reconoció o negó
   Colpensiones y con qué motivación. Identifica la resolución negada como ancla.
3. DATOS DUROS: semanas, edad, IBL, tasa, fechas y certificaciones pertinentes. Transcribe textualmente lo decisivo
   (entre comillas) cuando refuerce la defensa.
4. MARCO NORMATIVO: cita las normas aplicables a ESTA pretensión (leyes, decretos), en su texto pertinente.
5. DOCTRINA INTERNA DE COLPENSIONES: cuando exista en las fuentes, apóyate en circulares, memorandos y conceptos
   (p. ej. Circular Interna, Memorando OAL, conceptos de la Gerencia Nacional de Doctrina). Es la columna vertebral.
6. JURISPRUDENCIA: cita la de la Corte Suprema (Sala Laboral, "SLxxxx-año") y la Corte Constitucional (SU/C/T) que
   respalde la posición, SOLO si aparece en las fuentes autorizadas.
7. SUBSUNCIÓN: contrasta hecho por hecho contra el requisito legal. Concluye identificando el REQUISITO INCUMPLIDO
   por el demandante o la razón por la que la resolución goza de presunción de legalidad (art. 167 C.G.P.: la carga de
   desvirtuarla recae en el demandante).
8. PRETENSIONES ACCESORIAS: pronúnciate sobre intereses moratorios e indexación (ver bloque específico).
9. COROLARIO: cierra con que Colpensiones actuó conforme a la ley / la resolución goza de presunción de legalidad, en
   línea con la recomendación de NO conciliar.

ESTILO: jurídico institucional colombiano, tercera persona ("la entidad que represento", "mi representada"), cita textual
entre comillas, resalta en NEGRITA (doble asterisco **dato**) los datos clave (semanas, %, montos, resoluciones, fechas,
normas, sentencias).

FORMATO: responde SOLO el cuerpo de las CONSIDERACIONES, en prosa jurídica continua. NO agregues un encabezado de documento
ni repitas los datos del proceso (radicado, despacho, partes) como ficha inicial; NO uses tablas. Puedes usar subtítulos breves
para los pasos del método. Si detectas datos contradictorios o faltantes en las fuentes, deja constancia expresa de ello
(sin inventar el dato) para que el abogado lo verifique.`;

/** Bloque de pretensiones accesorias — casi plantilla; fija la doctrina correcta (resarcitoria). */
export const BLOQUE_ACCESORIAS = `PRETENSIONES ACCESORIAS (pronúnciate solo sobre las que pida la demanda):
- INTERESES MORATORIOS (art. 141 Ley 100/1993): tienen naturaleza RESARCITORIA (NO sancionatoria) y su causación se rige
  por la mora administrativa. Proceden solo si hay mora en el pago de una prestación ya reconocida. Si la prestación se
  negó por no cumplir requisitos, o el reconocimiento dependería de una decisión judicial, o Colpensiones actuó con apego
  a la ley, NO proceden. (No inventes radicados de sentencias: usa solo los que consten en las fuentes.)
- INDEXACIÓN: "lo accesorio sigue la suerte de lo principal"; si la pretensión principal no prospera, la indexación tampoco.
  Recuerda la incompatibilidad entre intereses moratorios e indexación reconocida por la jurisprudencia.`;

const TONO: Record<PosturaColpensiones, string> = {
  negacion:
    "POSTURA: Colpensiones NEGÓ la prestación. Tono CONCLUYENTE: demuestra con la subsunción que el demandante no cumple los requisitos.",
  pasiva:
    "POSTURA: Colpensiones es demandada pasiva o la falta se imputa a un tercero (AFP privada). Tono DEFENSIVO y MATIZADO: " +
    "resalta que la controversia exige valoración probatoria del juez, que no procede presumir el derecho de las solas " +
    "afirmaciones de la demanda y, cuando aplique, que la responsabilidad recae en el tercero; aun así, concluye NO conciliar.",
};

/** Control de alucinación en citas jurisprudenciales — el punto de mayor riesgo. */
export const REGLA_CITAS = `CITAS JURISPRUDENCIALES (control de alucinación — CRÍTICO):
- Cita una sentencia con su radicado (SL/SU/C/T-…) SOLO si aparece en las FUENTES (demanda, resoluciones, doctrina interna).
- NO reproduzcas de memoria listados de radicados, ni afirmes que una sentencia "reitera" algo si su número no consta.
- Si un argumento se apoya en una línea jurisprudencial cuya identificación NO obra en las fuentes, exprésalo de forma
  genérica ("conforme a la jurisprudencia reiterada de la Sala de Casación Laboral") SIN inventar el número.
- Cierra con una breve "NOTA DE TRAZABILIDAD DE CITAS": lista las sentencias que citaste e indica, para cada una, si
  OBRA EN LAS FUENTES o si es una REFERENCIA GENERAL A VERIFICAR por el abogado.`;

export const REGLAS_TRAZABILIDAD = `REGLAS ESTRICTAS:
- NO inventes hechos, fechas, cifras, normas ni jurisprudencia. Toda norma o sentencia citada debe aparecer en las fuentes.
- Usa EXCLUSIVAMENTE la información de las fuentes autorizadas que se te entregan. Si un dato necesario no consta, dilo
  ("no obra en el expediente") en vez de suponerlo.
- No adelantes cálculos aritméticos que no puedas derivar de los datos dados.`;

/**
 * Ensambla la instrucción completa de Consideraciones para inyectar en el prompt de
 * generación, ajustada a la postura del caso. Las FUENTES (expediente, resoluciones,
 * doctrina, jurisprudencia, demanda) las antepone el generador.
 */
export function instruccionConsideraciones(postura: PosturaColpensiones): string {
  return [
    METODO_CONSIDERACIONES,
    "",
    TONO[postura],
    "",
    JERARQUIA_ACTOS,
    "",
    BLOQUE_ACCESORIAS,
    "",
    REGLA_CITAS,
    "",
    REGLAS_TRAZABILIDAD,
  ].join("\n");
}

/**
 * Infiere la postura de Colpensiones a partir de la pretensión/texto. Los casos de
 * ineficacia/nulidad de traslado de régimen ubican a la entidad como demandada pasiva;
 * el resto (negación de prestación) es la postura concluyente por defecto.
 */
export function inferirPostura(
  pretension: string | null | undefined,
  clase: string | null | undefined,
  textoDemanda: string | null | undefined
): PosturaColpensiones {
  const t = `${pretension ?? ""} ${clase ?? ""} ${(textoDemanda ?? "").slice(0, 4000)}`.toLowerCase();
  const esTraslado =
    t.includes("ineficacia") ||
    t.includes("nulidad del traslado") ||
    (t.includes("traslado") && (t.includes("régimen") || t.includes("regimen") || t.includes("rais") || t.includes("prima media"))) ||
    t.includes("deber de información") ||
    t.includes("deber de informacion");
  return esTraslado ? "pasiva" : "negacion";
}

export type FuentesConsideraciones = {
  radicado: string;
  nombre_demandante: string;
  pretension: string | null;
  clase_pretension: string | null;
  jurisdiccion: string | null;
  /** Texto del expediente/demanda disponible (Fase A ampliará esto con todo el expediente). */
  textoDemanda: string;
  /** Lineamientos/directrices disponibles del caso. */
  textoLineamientos: string;
  pretende_intereses: boolean;
  pretende_indexacion: boolean;
  hay_fallo: boolean;
  sintesis_fallo: string | null;
  conciliable: boolean | null;
  /** Doctrina interna / repositorio institucional que coincide con el caso (RAG). */
  repositorio?: string;
  /** Jurisprudencia identificada (Sección 4) para el paso 6, en clave de defensa. */
  jurisprudencia?: string;
  /** 0 = sección completa (default) · 1 = pasos 1–5 · 2 = pasos 6–9 (para el split del cliente). */
  parte?: 0 | 1 | 2;
  /** Incluir ejemplos few-shot (default true en la completa). Poner false para aligerar en planes con 60s. */
  fewShot?: boolean;
};

/**
 * Arma el prompt completo (dedicado) para generar CONSIDERACIONES: encabezado + método
 * por postura + ejemplos few-shot + fuentes del caso. Pide SOLO el texto de la sección.
 */
export function construirPromptConsideraciones(f: FuentesConsideraciones): string {
  const postura = inferirPostura(f.pretension, f.clase_pretension, f.textoDemanda);
  const parte = f.parte ?? 0;

  // Few-shot: por defecto solo en la sección COMPLETA (parte 0), porque en el flujo dividido con
  // límite de 60s (Hobby) no cabe. Pero un `fewShot: true` explícito lo fuerza también en las
  // partes 1/2 (p. ej. corriendo en LOCAL con Opus 5, sin tope de tiempo) para máxima calidad.
  const usarFewshot = f.fewShot === true || (parte === 0 && f.fewShot !== false);
  const fewshot =
    !usarFewshot
      ? ""
      : [...EJEMPLOS_CONSIDERACIONES]
          .sort((a, b) => (a.postura === postura ? -1 : b.postura === postura ? 1 : 0))
          .slice(0, 3)
          .map((e, i) => `───── EJEMPLO ${i + 1} · ${e.etiqueta} (postura: ${e.postura}) ─────\n${e.texto}`)
          .join("\n\n");

  const tarea =
    parte === 1
      ? "GENERA SOLO los pasos 1 a 5 del método (delimitación, antecedentes administrativos, datos duros, marco normativo, doctrina interna). NO incluyas jurisprudencia, subsunción, accesorias ni corolario; termina justo tras la doctrina interna. Sé conciso y directo."
      : parte === 2
      ? "Ya se redactaron los pasos 1 a 5 (encuadre, datos y marco normativo); NO los repitas. Redacta SOLO los pasos 6 a 9 (jurisprudencia con control de citas, subsunción hecho↔requisito, pretensiones accesorias y corolario), empezando directamente en el marco jurisprudencial. Sé CONCISO: resume la ratio de cada sentencia en 1-2 frases y no transcribas en exceso, de modo que el COROLARIO con la recomendación (por regla general NO CONCILIAR) quede COMPLETO, nunca cortado."
      : "Redacta la sección COMPLETA siguiendo los 9 pasos del método.";

  const bloques: string[] = [];
  bloques.push(
    `EXPEDIENTE DEL CASO (documentos procesados: traslado, resoluciones, historia laboral, anexos):\n${
      f.textoDemanda?.trim() ? f.textoDemanda.slice(0, 120000) : "No se proporcionó texto del expediente."
    }`
  );
  if (f.textoLineamientos?.trim()) bloques.push(`LINEAMIENTOS / DIRECTRICES DEL CASO:\n${f.textoLineamientos.slice(0, 25000)}`);
  if (f.repositorio?.trim())
    bloques.push(
      `DOCTRINA INTERNA / REPOSITORIO INSTITUCIONAL (úsalo en el paso 5 y para ANCLAR las citas de doctrina/jurisprudencia; cítalo así: «(Repositorio: Memorando OAL 016)»):\n${f.repositorio.slice(0, 20000)}`
    );
  if (f.jurisprudencia?.trim() && parte !== 1)
    bloques.push(
      `JURISPRUDENCIA IDENTIFICADA (para el paso 6; cítala solo si es pertinente y aplícala EN CLAVE DE DEFENSA — si favorece al demandante, distínguela como riesgo a contrarrestar):\n${f.jurisprudencia.slice(0, 4000)}`
    );

  return `Eres abogado externo de COLPENSIONES, experto en derecho laboral y seguridad social colombiana.
Vas a redactar la sección CONSIDERACIONES de la Ficha de Conciliación (formato GDJ-GPO-FMT-005).

${instruccionConsideraciones(postura)}

${fewshot ? `═══════════ EJEMPLOS DE REFERENCIA (imita ESTILO y ESTRUCTURA; NO copies sus hechos, cifras ni sentencias) ═══════════\n\n${fewshot}\n\n` : ""}═══════════ CASO A RESOLVER — FUENTES AUTORIZADAS ═══════════

PARÁMETROS:
- Radicado: ${f.radicado}
- Demandante: ${f.nombre_demandante}
- Pretensión: ${f.pretension ?? "No especificada"}${f.clase_pretension ? ` — ${f.clase_pretension}` : ""}
- Jurisdicción: ${f.jurisdiccion ?? "No especificada"}
- Pretende intereses moratorios: ${f.pretende_intereses ? "Sí" : "No"}
- Pretende indexación: ${f.pretende_indexacion ? "Sí" : "No"}
- Hay fallo de primera instancia: ${f.hay_fallo ? "Sí" : "No"}${f.hay_fallo && f.sintesis_fallo ? `\n- Síntesis del fallo: ${f.sintesis_fallo}` : ""}

${bloques.join("\n\n")}

═══════════ TU TAREA ═══════════
${tarea}
Usa SOLO las fuentes autorizadas de arriba. Responde en prosa jurídica, sin JSON, sin encabezado de documento ni tablas: SOLO el texto de las Consideraciones${parte === 1 ? " (pasos 1–5)" : parte === 2 ? " (pasos 6–9)" : ""}.`;
}

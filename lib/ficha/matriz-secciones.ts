/**
 * Matriz de mapeo de las 19 secciones de la Ficha de Conciliación Judicial
 * Formato oficial GDJ-GPO-FMT-005 v2 (08/03/2023) — Colpensiones
 *
 * Fuente de verdad para la generación controlada:
 * - Define de dónde puede salir la información de cada sección.
 * - La construcción de prompts SOLO puede incluir las fuentes aquí autorizadas.
 * - Si falta la fuente primaria y la sección no admite N/A, se genera advertencia
 *   y pendiente — NUNCA se inventa contenido.
 *
 * Colores del template oficial (extraídos del DOCX modelo):
 * - Amarillo → base Excel/CSV (encabezado)
 * - Verde    → traslado de la demanda (secciones 1-4, 7, 8)
 * - Azul     → directrices Colpensiones (sección 15; alimenta también 16-18)
 */

export type FuenteTipo =
  | "excel_csv"
  | "traslado_demanda"
  | "acto_administrativo"
  | "directriz_colpensiones"
  | "manual"
  | "mixta";

export type FichaSectionMapping = {
  sectionNumber: number;
  /** Título oficial tal como aparece en el template */
  title: string;
  /** Columna en fichas_conciliacion */
  dbColumn: string;
  primarySource: FuenteTipo;
  secondarySources: FuenteTipo[];
  /** Celda del template XLSX oficial (columna B, filas alternadas) */
  templateCellXlsx: string;
  requiresAI: boolean;
  requiresHumanReview: boolean;
  /** Revisión humana obligatoria antes de aprobar (secciones de criterio jurídico) */
  criticalReview: boolean;
  canBeNA: boolean;
  /** Insumos que deben existir para generar la sección */
  requiredInputs: string[];
};

export const MATRIZ_SECCIONES: FichaSectionMapping[] = [
  {
    sectionNumber: 1,
    title: "SÍNTESIS DE LOS HECHOS",
    dbColumn: "sec_1_hechos",
    primarySource: "traslado_demanda",
    secondarySources: [],
    templateCellXlsx: "B19",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: false,
    requiredInputs: ["documento:traslado_demanda"],
  },
  {
    sectionNumber: 2,
    title: "PRETENSIONES",
    dbColumn: "sec_2_pretensiones",
    primarySource: "traslado_demanda",
    secondarySources: ["manual"],
    templateCellXlsx: "B21",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: false,
    requiredInputs: ["documento:traslado_demanda"],
  },
  {
    sectionNumber: 3,
    title: "CUANTÍA",
    dbColumn: "sec_3_cuantia",
    primarySource: "traslado_demanda",
    secondarySources: ["manual"],
    templateCellXlsx: "B23",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: false,
    requiredInputs: ["param:cuantia_tipo"],
  },
  {
    sectionNumber: 4,
    title: "PRESUNTAS NORMAS VIOLADAS – FUNDAMENTOS DE DERECHO",
    dbColumn: "sec_4_normas",
    primarySource: "traslado_demanda",
    secondarySources: [],
    templateCellXlsx: "B25",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: false,
    requiredInputs: ["documento:traslado_demanda"],
  },
  {
    sectionNumber: 5,
    title: "ARGUMENTOS DE LA APELACIÓN",
    dbColumn: "sec_5_apelacion",
    primarySource: "manual",
    secondarySources: ["traslado_demanda"],
    templateCellXlsx: "B27",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: true,
    requiredInputs: [],
  },
  {
    sectionNumber: 6,
    title: "SENTENCIA",
    dbColumn: "sec_6_sentencia",
    primarySource: "manual",
    secondarySources: [],
    templateCellXlsx: "B29",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: true,
    requiredInputs: ["param:hay_fallo"],
  },
  {
    sectionNumber: 7,
    title: "SOPORTE PROBATORIO OBRANTE EN EL EXPEDIENTE",
    dbColumn: "sec_7_probatorio",
    primarySource: "traslado_demanda",
    secondarySources: ["acto_administrativo"],
    templateCellXlsx: "B31",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: false,
    requiredInputs: ["documento:traslado_demanda"],
  },
  {
    sectionNumber: 8,
    title: "PLANTEAMIENTO DEL PROBLEMA JURÍDICO – HOMOLOGADO CON OBJETO CONCILIABLE",
    dbColumn: "sec_8_problema",
    primarySource: "mixta",
    secondarySources: ["traslado_demanda", "directriz_colpensiones"],
    templateCellXlsx: "B33",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: false,
    requiredInputs: ["documento:traslado_demanda", "tipologia"],
  },
  {
    sectionNumber: 9,
    title: "ANÁLISIS DE LA CADUCIDAD",
    dbColumn: "sec_9_caducidad",
    primarySource: "manual",
    secondarySources: [],
    templateCellXlsx: "B35",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: true,
    requiredInputs: ["param:caducidad"],
  },
  {
    sectionNumber: 10,
    title: "PRINCIPALES MOVIMIENTOS PROCESALES",
    dbColumn: "sec_10_movimientos",
    primarySource: "traslado_demanda",
    secondarySources: ["manual"],
    templateCellXlsx: "B37",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: true,
    requiredInputs: [],
  },
  {
    sectionNumber: 11,
    title: "JURISPRUDENCIA O PRECEDENTE JUDICIAL",
    dbColumn: "sec_11_jurisprudencia",
    primarySource: "directriz_colpensiones",
    secondarySources: ["manual"],
    templateCellXlsx: "B39",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: true,
    requiredInputs: ["directriz"],
  },
  {
    sectionNumber: 12,
    title: "DOCTRINA",
    dbColumn: "sec_12_doctrina",
    primarySource: "directriz_colpensiones",
    secondarySources: ["manual"],
    templateCellXlsx: "B41",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: true,
    requiredInputs: ["directriz"],
  },
  {
    sectionNumber: 13,
    title: "DECISIONES QUE TOMÓ EL COMITÉ EN LA CONCILIACIÓN EXTRAJUDICIAL (SI APLICA)",
    dbColumn: "sec_13_comite_ext",
    primarySource: "manual",
    secondarySources: [],
    templateCellXlsx: "B43",
    requiresAI: false,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: true,
    requiredInputs: [],
  },
  {
    sectionNumber: 14,
    title: "DECISIONES QUE TOMÓ EL COMITÉ EN CASOS SIMILARES",
    dbColumn: "sec_14_casos_similares",
    primarySource: "directriz_colpensiones",
    secondarySources: ["manual"],
    templateCellXlsx: "B45",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: true,
    requiredInputs: ["directriz"],
  },
  {
    sectionNumber: 15,
    title: "APLICA POLÍTICA, LLAMAMIENTOS, PROTOCOLOS O INSTRUCTIVOS INSTITUCIONALES (EN CASO QUE APLIQUE)",
    dbColumn: "sec_15_politicas",
    primarySource: "directriz_colpensiones",
    secondarySources: [],
    templateCellXlsx: "B47",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: false,
    canBeNA: true,
    requiredInputs: ["directriz"],
  },
  {
    sectionNumber: 16,
    title: "CONSIDERACIONES",
    dbColumn: "sec_16_consideraciones",
    primarySource: "mixta",
    secondarySources: ["directriz_colpensiones", "traslado_demanda", "acto_administrativo"],
    templateCellXlsx: "B49",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: true,
    canBeNA: false,
    requiredInputs: ["directriz", "documento:traslado_demanda"],
  },
  {
    sectionNumber: 17,
    title: "EVALUACIÓN DEL RIESGO",
    dbColumn: "sec_17_riesgo",
    primarySource: "directriz_colpensiones",
    secondarySources: ["acto_administrativo", "manual"],
    templateCellXlsx: "B51",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: true,
    canBeNA: false,
    requiredInputs: ["directriz"],
  },
  {
    sectionNumber: 18,
    title: "RECOMENDACIÓN PARA EL CASO",
    dbColumn: "sec_18_recomendacion",
    primarySource: "directriz_colpensiones",
    secondarySources: ["manual"],
    templateCellXlsx: "B53",
    requiresAI: true,
    requiresHumanReview: true,
    criticalReview: true,
    canBeNA: false,
    requiredInputs: ["directriz", "param:conciliable"],
  },
  {
    sectionNumber: 19,
    title: "ELABORÓ (APODERADO Y FIRMA EXTERNA)",
    dbColumn: "sec_19_elaboro",
    primarySource: "manual",
    secondarySources: [],
    templateCellXlsx: "B55",
    requiresAI: false,
    requiresHumanReview: false,
    criticalReview: false,
    canBeNA: false,
    requiredInputs: ["perfil:nombre_completo"],
  },
];

/**
 * Campos del encabezado del template (amarillo = base Excel/CSV)
 */
export const ENCABEZADO_FICHA = [
  { campo: "tipo_conciliacion",  celda: "C8",  fuente: "manual"    as FuenteTipo },
  { campo: "fecha_diligencia",   celda: "C9",  fuente: "manual"    as FuenteTipo },
  { campo: "radicado_bizagi",    celda: "C10", fuente: "excel_csv" as FuenteTipo },
  { campo: "radicado",           celda: "C11", fuente: "excel_csv" as FuenteTipo },
  { campo: "nombre_demandante",  celda: "C12", fuente: "excel_csv" as FuenteTipo },
  { campo: "expediente_pensional_aplica", celda: "C13", fuente: "excel_csv" as FuenteTipo },
  { campo: "despacho",           celda: "C14", fuente: "excel_csv" as FuenteTipo },
  { campo: "caducidad",          celda: "C15", fuente: "manual"    as FuenteTipo },
] as const;

/** Obtiene el mapping de una sección por número */
export function getSeccion(n: number): FichaSectionMapping | undefined {
  return MATRIZ_SECCIONES.find((s) => s.sectionNumber === n);
}

/**
 * Valida qué secciones pueden generarse con los insumos disponibles.
 * Devuelve por sección: si es generable, y qué insumos faltan.
 */
export type InsumosDisponibles = {
  /** tipos de documento cargados y procesados ok, ej. ['traslado_demanda'] */
  documentos: string[];
  /** true si el caso tiene tipología asignada */
  tieneTipologia: boolean;
  /** true si hay directriz aplicable seleccionada */
  tieneDirectriz: boolean;
  /** parámetros del formulario con valor no nulo, ej. ['cuantia_tipo', 'hay_fallo'] */
  params: string[];
  /** true si el perfil del abogado tiene nombre completo */
  tienePerfil: boolean;
};

export type ValidacionSeccion = {
  sectionNumber: number;
  title: string;
  generable: boolean;
  faltantes: string[];
  /** si no es generable pero admite N/A, se llena con N/A sin inventar */
  resolverComoNA: boolean;
};

export function validarInsumos(insumos: InsumosDisponibles): ValidacionSeccion[] {
  return MATRIZ_SECCIONES.map((s) => {
    const faltantes: string[] = [];
    for (const req of s.requiredInputs) {
      if (req.startsWith("documento:")) {
        const tipo = req.slice("documento:".length);
        if (!insumos.documentos.includes(tipo)) faltantes.push(req);
      } else if (req.startsWith("param:")) {
        const p = req.slice("param:".length);
        if (!insumos.params.includes(p)) faltantes.push(req);
      } else if (req === "tipologia") {
        if (!insumos.tieneTipologia) faltantes.push(req);
      } else if (req === "directriz") {
        if (!insumos.tieneDirectriz) faltantes.push(req);
      } else if (req.startsWith("perfil:")) {
        if (!insumos.tienePerfil) faltantes.push(req);
      }
    }
    const generable = faltantes.length === 0;
    return {
      sectionNumber: s.sectionNumber,
      title: s.title,
      generable,
      faltantes,
      resolverComoNA: !generable && s.canBeNA,
    };
  });
}

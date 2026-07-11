// Clasificación oficial de las 19 secciones
export type TipoSeccion = "AUTO" | "DEFAULT" | "MANUAL";

export interface DefSeccion {
  numero: number;
  key: string;        // columna en BD
  label: string;
  tipo: TipoSeccion;
  descripcion: string;
}

export const SECCIONES: DefSeccion[] = [
  { numero: 1,  key: "sec_1_hechos",           label: "Síntesis de hechos",          tipo: "AUTO",    descripcion: "IA genera síntesis de los hechos de la demanda." },
  { numero: 2,  key: "sec_2_pretensiones",     label: "Pretensiones",                tipo: "AUTO",    descripcion: "IA extrae y lista las pretensiones." },
  { numero: 3,  key: "sec_3_cuantia",          label: "Cuantía",                     tipo: "AUTO",    descripcion: "IA calcula o describe la cuantía según los parámetros." },
  { numero: 4,  key: "sec_4_normas",           label: "Normas violadas",             tipo: "AUTO",    descripcion: "IA identifica las normas invocadas en la demanda." },
  { numero: 5,  key: "sec_5_apelacion",        label: "Arg. de apelación",           tipo: "DEFAULT", descripcion: "Texto por defecto según si hay fallo o no." },
  { numero: 6,  key: "sec_6_sentencia",        label: "Sentencia",                   tipo: "DEFAULT", descripcion: "Texto por defecto según si hay fallo de segunda instancia." },
  { numero: 7,  key: "sec_7_probatorio",       label: "Soporte probatorio",          tipo: "MANUAL",  descripcion: "El abogado diligencia desde el expediente físico." },
  { numero: 8,  key: "sec_8_problema",         label: "Problema jurídico",           tipo: "AUTO",    descripcion: "IA plantea el problema jurídico central." },
  { numero: 9,  key: "sec_9_caducidad",        label: "Análisis de caducidad",       tipo: "DEFAULT", descripcion: "Texto por defecto según jurisdicción." },
  { numero: 10, key: "sec_10_movimientos",     label: "Mov. procesales",             tipo: "MANUAL",  descripcion: "El abogado registra los movimientos del expediente." },
  { numero: 11, key: "sec_11_jurisprudencia",  label: "Jurisprudencia",              tipo: "MANUAL",  descripcion: "El abogado cita la jurisprudencia aplicable." },
  { numero: 12, key: "sec_12_doctrina",        label: "Doctrina",                    tipo: "MANUAL",  descripcion: "El abogado referencia la doctrina relevante." },
  { numero: 13, key: "sec_13_comite_ext",      label: "Comité extrajudicial",        tipo: "DEFAULT", descripcion: "Texto por defecto sobre el comité extrajudicial." },
  { numero: 14, key: "sec_14_casos_similares", label: "Casos similares",             tipo: "DEFAULT", descripcion: "Texto por defecto referenciando casos análogos." },
  { numero: 15, key: "sec_15_politicas",       label: "Políticas / llamamientos",    tipo: "DEFAULT", descripcion: "Texto por defecto con políticas de Colpensiones." },
  { numero: 16, key: "sec_16_consideraciones", label: "Consideraciones",             tipo: "AUTO",    descripcion: "IA genera las consideraciones jurídicas." },
  { numero: 17, key: "sec_17_riesgo",          label: "Evaluación de riesgo",        tipo: "DEFAULT", descripcion: "Texto por defecto según el nivel de riesgo estimado." },
  { numero: 18, key: "sec_18_recomendacion",   label: "Recomendación",               tipo: "AUTO",    descripcion: "IA genera la recomendación de conciliación." },
  { numero: 19, key: "sec_19_elaboro",         label: "Elaboró",                     tipo: "MANUAL",  descripcion: "El abogado firma y registra quién elaboró la ficha." },
];

export const BADGE_TIPO: Record<TipoSeccion, { label: string; clase: string }> = {
  AUTO:    { label: "AUTO",    clase: "bg-green-100 text-green-700 border-green-200" },
  DEFAULT: { label: "DEFAULT", clase: "bg-blue-100 text-blue-700 border-blue-200" },
  MANUAL:  { label: "MANUAL",  clase: "bg-yellow-100 text-yellow-700 border-yellow-200" },
};

// Textos DEFAULT según condiciones del caso
export function generarTextoDefault(
  key: string,
  opts: {
    hay_fallo: boolean;
    jurisdiccion: string | null;
    pretension: string | null;
    conciliable: boolean;
    tipo_conciliacion: string;
  }
): string {
  switch (key) {
    case "sec_5_apelacion":
      return opts.hay_fallo
        ? "El proceso cuenta con fallo de segunda instancia. Los argumentos de apelación han sido resueltos por el superior jerárquico."
        : "El proceso se encuentra en primera instancia. No se han formulado argumentos de apelación a la fecha de elaboración de la presente ficha.";

    case "sec_6_sentencia":
      return opts.hay_fallo
        ? "Existe sentencia de segunda instancia en el presente proceso, la cual deberá ser analizada en conjunto con los demás elementos de juicio para efectos de la conciliación."
        : "A la fecha de elaboración de la presente ficha no existe sentencia ejecutoriada en el proceso. El caso se encuentra en etapa de primera instancia.";

    case "sec_9_caducidad":
      return opts.jurisdiccion === "contencioso"
        ? "Conforme al artículo 164 de la Ley 1437 de 2011 (CPACA), se verifica que la acción fue presentada dentro del término de caducidad de cuatro (4) meses previsto para los medios de control de nulidad y restablecimiento del derecho en materia pensional."
        : "Conforme al artículo 151 del Código Procesal del Trabajo y de la Seguridad Social, se verifica que la acción fue presentada dentro del término ordinario de prescripción de tres (3) años establecido para las acreencias laborales y prestacionales.";

    case "sec_13_comite_ext":
      return opts.conciliable
        ? "El presente asunto fue evaluado por el Comité de Conciliación Extrajudicial de Colpensiones, determinándose que reúne los requisitos para ser objeto de acuerdo conciliatorio en los términos de la política institucional vigente."
        : "El presente asunto fue evaluado por el Comité de Conciliación Extrajudicial de Colpensiones. Se determinó que el asunto no es susceptible de conciliación extrajudicial por no cumplir los criterios establecidos en la directriz institucional vigente.";

    case "sec_14_casos_similares":
      return `En procesos de naturaleza similar relacionados con pretensiones de ${opts.pretension ?? "seguridad social"}, Colpensiones ha adoptado decisiones concordantes con la jurisprudencia constitucional y ordinaria vigente, procurando la solución anticipada de los conflictos cuando las condiciones fácticas y jurídicas lo permiten.`;

    case "sec_15_politicas":
      return "De conformidad con las directrices del Comité de Conciliación de Colpensiones y en cumplimiento de la Ley 1285 de 2009, la Ley 446 de 1998 y el Decreto 1716 de 2009, se procede a evaluar la viabilidad de conciliación judicial del presente proceso, atendiendo los criterios de legalidad, conveniencia institucional y eficiencia en la gestión del litigio.";

    case "sec_17_riesgo":
      return opts.tipo_conciliacion === "condicional"
        ? "RIESGO MEDIO — El proceso presenta elementos de incertidumbre probatoria que hacen recomendable evaluar una fórmula de arreglo condicional. Se recomienda conciliar bajo condición resolutoria."
        : "RIESGO ALTO — Atendiendo el análisis de los hechos, el material probatorio y la jurisprudencia aplicable, existe alta probabilidad de condena. Se recomienda proponer fórmula de arreglo dentro de los parámetros de la directriz vigente.";

    default:
      return "";
  }
}

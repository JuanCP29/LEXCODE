/**
 * Registro central de reglas por sección (Fase 2).
 *
 * Fuente ÚNICA de verdad de "qué extraer / cómo redactar" cada sección de la
 * ficha. Lo consumen los dos caminos del análisis (visión y texto) y la
 * regeneración por sección, para que un ajuste se haga en un solo lugar.
 *
 * Convención: texto de UNA sola línea y SIN comillas dobles rectas (usa
 * comillas simples ' o angulares « »), para poder interpolarse tanto en prosa
 * (visión) como dentro de un ejemplo JSON en el prompt (texto) sin romperlo.
 */

// Instrucción compartida: resaltar en negrita (Markdown **) los datos clave.
// El editor y los exports interpretan **texto** como negrita.
export const RESALTAR_NEGRITA =
  "FORMATO: resalta en NEGRITA usando doble asterisco (**dato**) los datos CLAVE —numero de semanas, porcentajes (tasa de " +
  "reemplazo, IBL %), montos en pesos, numeros de resolucion/oficio, fechas relevantes, nombres propios de personas— y los " +
  "SUBTITULOS. Usa la negrita con mesura, solo en lo importante; no marques frases enteras.";

export const REGLA_CUANTIA =
  "Busca la seccion 'CUANTIA', 'COMPETENCIA Y CUANTIA' o 'ESTIMACION DE LA CUANTIA'. Devuelve EXACTAMENTE la frase " +
  "'La cuantia fue estimada por la parte actora, en <VALOR>.' donde <VALOR> es el monto en FORMATO MONEDA con simbolo '$', " +
  "separadores de miles con PUNTO y decimales con COMA (ej. '$275.353.309,53'). NO escribas 'COP' ni 'pesos'. Si el valor esta " +
  "en salarios minimos, dejalo como '20 SMLMV'. Si no encuentras el valor de la cuantia, pon null.";

export const REGLA_NORMAS =
  "Devuelve DOS bloques con base UNICAMENTE en lo que aparezca TEXTUALMENTE en el TRASLADO. " +
  "(1) NORMAS citadas (busca la seccion 'FUNDAMENTOS Y RAZONES DE DERECHO', 'NORMAS VIOLADAS' o 'CONCEPTO DE VIOLACION'), " +
  "CONSOLIDANDO por norma: cada ley, decreto, codigo o la Constitucion aparece UNA SOLA VEZ, con TODOS sus articulos juntos " +
  "separados por coma y en orden ascendente. UNA norma por linea, cada linea empieza con vineta '• ' " +
  "(ej. '• Ley 100 de 1993, articulos 9, 10, 14, 34, 141'). No repitas una misma norma en varias lineas. " +
  "(2) JURISPRUDENCIA de altas cortes que la demanda cite en cualquier parte del texto —Corte Suprema de Justicia Sala Laboral " +
  "(sentencias 'SL'), Corte Constitucional ('C-', 'T-', 'SU-') y Consejo de Estado—: si hay al menos una, antecede el bloque con " +
  "una linea que diga EXACTAMENTE 'Jurisprudencia:' (sin vineta) y lista UNA sentencia por linea con '• ', indicando corporacion " +
  "y numero de sentencia/radicado como aparezcan (ej. '• Corte Suprema de Justicia, Sala Laboral, sentencia SL3501-2022, " +
  "radicacion 92207'). NUNCA inventes normas ni sentencias, ni uses las que figuran como ejemplo aqui si no constan en la demanda. " +
  "Si la demanda no cita jurisprudencia, omite el bloque 'Jurisprudencia:'. Si no encuentras normas, pon null.";

export const REGLA_PROBLEMA_JURIDICO =
  "Redacta el PLANTEAMIENTO DEL PROBLEMA JURIDICO en UN SOLO PARRAFO, como planteamiento de la controversia " +
  "(NO en forma de pregunta: sin signos '¿ ?' ni terminar con '?'). SEGUN LA JURISDICCION: " +
  "CONTENCIOSO ADMINISTRATIVA (Juzgado/Tribunal Administrativo, o medio de control de nulidad y restablecimiento del derecho) -> " +
  "el planteamiento DEBE INICIAR por la procedencia de la declaratoria de nulidad, con la estructura 'Determinar si se debe " +
  "declarar la nulidad [total o parcial] de la Resolucion No <numero> del <fecha> mediante la cual COLPENSIONES " +
  "<reconocio/nego/liquido ...>, y si, como consecuencia de ello, hay lugar a <la accion principal> con el correspondiente " +
  "retroactivo e intereses moratorios o indexacion' (usa los numeros de resolucion y fechas que consten). " +
  "ORDINARIA LABORAL (Juzgado Laboral del Circuito o Municipal) -> 'Determinar si <nucleo de la controversia respecto de la accion " +
  "principal>, y si, como consecuencia de ello, hay lugar a <la accion principal> con el correspondiente retroactivo e intereses " +
  "moratorios o indexacion'. En AMBOS casos ATERRIZA a UNA SOLA ACCION PRINCIPAL (RELIQUIDACION si ya goza de pension; " +
  "RECONOCIMIENTO si no la tiene; NULIDAD/reincorporacion si se discute traslado de regimen). NO menciones costas procesales ni " +
  "agencias en derecho. Tercera persona, formal, COLPENSIONES como demandada. Si no puedes determinar la controversia, pon null.";

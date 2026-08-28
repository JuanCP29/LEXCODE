import { FIRMA_ELABORO } from "@/lib/ficha/firma-elaboro";

// Apoderada que suscribe (primera línea del bloque de firma).
const APODERADA = FIRMA_ELABORO.split("\n")[0];

const PERSONERIA =
  `${APODERADA}, abogada en ejercicio, identificada como aparece al pie de mi correspondiente firma, en mi calidad de apoderada ` +
  `sustituto de la Administradora Colombiana de Pensiones en adelante COLPENSIONES, cordialmente solicito al Despacho reconocerme ` +
  `personería para actuar de acuerdo al poder de sustitución adjunto y estando dentro del término de la oportunidad procesal, de ` +
  `manera respetuosa me permito dar contestación a la demanda propuesta dentro del proceso de la referencia instaurado contra mi ` +
  `representada, para que mediante sentencia que haga tránsito a cosa juzgada se absuelva a mi representada de todas y cada una de ` +
  `las pretensiones propuestas en la demanda y se condene en costas a la demandante.`;

const NATURALEZA =
  `La Administradora Colombiana de Pensiones -COLPENSIONES- es una empresa industrial y comercial del estado del orden nacional, ` +
  `organizada como entidad financiera de carácter especial, vinculada al Ministerio de Trabajo con personería jurídica, autonomía ` +
  `administrativa y patrimonio independiente, cuyo objeto consiste en la administración estatal del régimen de prima media con ` +
  `prestación definida incluyendo la administración de los beneficios económicos periódicos de que trata el Acto Legislativo 01 de ` +
  `2005 modificatorio del artículo 48 de la Constitución Política, de acuerdo con lo que establezca la ley que los desarrolle. La ` +
  `representación legal la ejerce el Doctor JAIME DUSSAN CALDERON, o quien haga sus veces. El domicilio principal es la ciudad de ` +
  `Bogotá D.C., en la Carrera 10 No. 72-33 Torre B piso 11, número telefónico 2170100.`;

const NOTIFICACIONES =
  `La suscrita recibirá notificaciones en la secretaría de su Despacho o en la dirección registrada por la firma a la que se ` +
  `encuentra adscrita. COLPENSIONES las recibe en su domicilio principal indicado y en los canales oficiales dispuestos para el ` +
  `efecto.`;

export type DatosContestacion = {
  radicado: string;
  nombre_demandante: string;
  cedula_demandante: string | null;
  jurisdiccion: string | null;
  despacho: string | null;
  sec_hechos: string | null;
  sec_pretensiones: string | null;
  sec_defensa: string | null;
};

// Bloque de documento: título centrado (h), párrafo (p), líneas de referencia (ref)
// o contenido enriquecido de sección (rich: HTML o texto plano, con formato).
export type Bloque =
  | { t: "h"; texto: string }
  | { t: "p"; texto: string; bold?: boolean; center?: boolean }
  | { t: "ref"; label: string; valor: string }
  | { t: "rich"; contenido: string | null }
  | { t: "sp" };

/** Construye el documento de contestación como una lista ordenada de bloques. */
export function construirBloquesContestacion(d: DatosContestacion): Bloque[] {
  const referencia = d.jurisdiccion === "contencioso"
    ? "MEDIO DE CONTROL DE NULIDAD Y RESTABLECIMIENTO DEL DERECHO"
    : "ORDINARIO LABORAL DE PRIMERA INSTANCIA";
  const demandante = `${d.nombre_demandante}${d.cedula_demandante ? ` C.C. ${d.cedula_demandante}` : ""}`;

  const bloques: Bloque[] = [
    { t: "p", texto: "Señor(a)", bold: true },
    { t: "p", texto: (d.despacho ?? "JUEZ LABORAL DEL CIRCUITO").toUpperCase(), bold: true },
    { t: "p", texto: "E.      S.      D.", bold: true },
    { t: "sp" },
    { t: "ref", label: "REFERENCIA:", valor: referencia },
    { t: "ref", label: "ASUNTO:", valor: "CONTESTACIÓN DE DEMANDA" },
    { t: "ref", label: "DEMANDANTE:", valor: demandante },
    { t: "ref", label: "DEMANDADO:", valor: "Administradora Colombiana de Pensiones - COLPENSIONES" },
    { t: "ref", label: "RADICACIÓN:", valor: d.radicado },
    { t: "sp" },
    { t: "p", texto: PERSONERIA },
    { t: "sp" },
    { t: "h", texto: "NATURALEZA JURÍDICA DE LA ENTIDAD DEMANDADA, REPRESENTACIÓN LEGAL Y DOMICILIO" },
    { t: "p", texto: NATURALEZA },
    { t: "sp" },
    { t: "h", texto: "PRONUNCIAMIENTO EXPRESO FRENTE A LOS HECHOS DE LA DEMANDA" },
    { t: "rich", contenido: d.sec_hechos },
    { t: "sp" },
    { t: "h", texto: "PRONUNCIAMIENTO EXPRESO FRENTE A LAS PRETENSIONES" },
    { t: "rich", contenido: d.sec_pretensiones },
    { t: "sp" },
    { t: "h", texto: "HECHOS, FUNDAMENTOS Y RAZONES DE LA DEFENSA" },
    { t: "rich", contenido: d.sec_defensa },
    { t: "sp" },
    { t: "h", texto: "NOTIFICACIONES" },
    { t: "p", texto: NOTIFICACIONES },
    { t: "sp" },
    { t: "p", texto: "Atentamente," },
    { t: "sp" },
    ...FIRMA_ELABORO.split("\n").map((l) => ({ t: "p", texto: l } as Bloque)),
  ];
  return bloques;
}

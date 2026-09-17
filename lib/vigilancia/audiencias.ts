// Extracción de audiencias desde el texto de una actuación de la Rama Judicial.
// Detecta cuando una actuación FIJA/SEÑALA una audiencia y parsea fecha/hora y tipo,
// tolerando la redacción judicial ("veinte (20) de marzo de 2026 a las 9:00 a. m.").

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Verbo/expresión que indica programación de audiencia (no un acta pasada).
const PROGRAMA =
  /\b(fija|fijar|fijase|f[ií]jese|se[ñn]ala|se[ñn]alamiento|programa|reprograma|cita|convoca|convocase|decreta|d[eé]crase)\b/i;

export type AudienciaExtraida = {
  esAudiencia: boolean;
  fechaISO: string | null;   // null → "por confirmar"
  tipo: string;
};

// Parsea una fecha (y hora si aparece) en texto libre en español. Devuelve Date local o null.
// Recolecta TODAS las fechas y se queda con la ÚLTIMA: en una actuación la primera fecha suele
// ser la de registro y la de la AUDIENCIA aparece después ("… PARA EL DÍA 14/10/2026"); en una
// reprogramación, la última es la fecha nueva. La hora se busca a partir de esa fecha.
export function parseFechaHora(textoRaw: string): Date | null {
  const texto = textoRaw || "";
  const cands: { i: number; y: number; m: number; d: number }[] = [];

  // Textual: "20 de marzo de 2026" (con ")" opcional; case-insensitive por el texto en MAYÚSCULAS)
  for (const m of Array.from(texto.matchAll(/(\d{1,2})\s*\)?\s*de\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+de\s+(\d{4})/gi))) {
    const mes = MESES[sinAcentos(m[2])];
    if (mes) cands.push({ i: m.index ?? 0, y: +m[3], m: mes, d: +m[1] });
  }
  // Numérica dd/mm/yyyy
  for (const m of Array.from(texto.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/g))) {
    cands.push({ i: m.index ?? 0, y: +m[3], m: +m[2], d: +m[1] });
  }
  // ISO yyyy-mm-dd
  for (const m of Array.from(texto.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))) {
    cands.push({ i: m.index ?? 0, y: +m[1], m: +m[2], d: +m[3] });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.i - b.i);
  const c = cands[cands.length - 1]; // la última fecha del texto
  if (c.m > 12 || c.d > 31) return null;

  // Hora, buscada desde la posición de la fecha elegida ("… 14/10/2026 HORA 9:00 AM")
  let hh = 0, mm = 0;
  const ht = texto.slice(c.i).match(/\b(\d{1,2})[:.](\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i);
  if (ht) {
    hh = +ht[1]; mm = +ht[2];
    const ap = sinAcentos(ht[3] || "").replace(/[\s.]/g, "");
    if (ap.startsWith("p") && hh < 12) hh += 12;
    if (ap.startsWith("a") && hh === 12) hh = 0;
  }
  const dt = new Date(c.y, c.m - 1, c.d, hh, mm, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function tipoAudiencia(t: string): string {
  if (/art[ií]?c?u?l?o?\.?\s*77|audiencia\s+inicial/i.test(t)) return "Audiencia inicial (art. 77)";
  if (/art[ií]?c?u?l?o?\.?\s*80|tr[aá]mite\s+y\s+juzgamiento/i.test(t)) return "Trámite y juzgamiento (art. 80)";
  if (/conciliaci[oó]n/i.test(t)) return "Audiencia de conciliación";
  return "Audiencia";
}

export function extraerAudiencia(actuacion: string | null, anotacion: string | null): AudienciaExtraida {
  const no: AudienciaExtraida = { esAudiencia: false, fechaISO: null, tipo: "Audiencia" };
  const act = actuacion ?? "";
  const t = `${act} ${anotacion ?? ""}`;
  if (!/audiencia/i.test(t)) return no;

  // Los memoriales/recepciones son solicitudes de parte, no la providencia que fija la audiencia.
  if (/memorial|recepci[oó]n\s+de/i.test(act)) return no;

  // Señal de que la providencia PROGRAMA/FIJA la audiencia (excluye "Acta audiencia" ya realizada).
  const programa =
    PROGRAMA.test(t) ||
    /reitera(r)?|fecha\s+(para|y\s+hora)/i.test(t) ||
    (/audiencia/i.test(act) && /fija|se[ñn]ala|fecha/i.test(t));
  if (!programa) return no;

  const fecha = parseFechaHora(t);
  return { esAudiencia: true, fechaISO: fecha ? fecha.toISOString() : null, tipo: tipoAudiencia(t) };
}

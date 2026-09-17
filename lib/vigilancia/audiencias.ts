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
export function parseFechaHora(textoRaw: string): Date | null {
  const texto = textoRaw || "";
  let y = 0, m = 0, d = 0;

  // 1) "20 de marzo de 2026" (con ")" opcional tras el día; case-insensitive: el texto
  //    judicial suele venir en MAYÚSCULAS ("7 DE JULIO DE 2026").
  const tt = texto.match(/(\d{1,2})\s*\)?\s*de\s+([A-Za-zÁÉÍÓÚáéíóú]+)\s+de\s+(\d{4})/i);
  if (tt && MESES[sinAcentos(tt[2])]) {
    d = +tt[1]; m = MESES[sinAcentos(tt[2])]; y = +tt[3];
  } else {
    const iso = texto.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    const num = texto.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b/);
    if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
    else if (num) { d = +num[1]; m = +num[2]; y = +num[3]; }
  }
  if (!y || !m || !d || m > 12 || d > 31) return null;

  // Hora: "9:00 a. m.", "14:30", "10:00 horas"
  let hh = 0, mm = 0;
  const ht = texto.match(/\b(\d{1,2})[:.](\d{2})\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?/i);
  if (ht) {
    hh = +ht[1]; mm = +ht[2];
    const ap = sinAcentos(ht[3] || "").replace(/[\s.]/g, "");
    if (ap.startsWith("p") && hh < 12) hh += 12;
    if (ap.startsWith("a") && hh === 12) hh = 0;
  }
  const dt = new Date(y, m - 1, d, hh, mm, 0);
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

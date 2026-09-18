// Fuente 2 — Publicaciones Procesales (Liferay, sin captcha). Obtiene el DOCUMENTO de la última
// actuación (auto/sentencia individual, o el estado consolidado) para un radicado, con la lógica
// "columna G" del PoC: buscar por despacho + ventana de fechas → detalle por articleId → casar por
// el consecutivo del radicado; si no hay individual, cae al "Estado NNN.pdf" consolidado.

const BASE = "https://publicacionesprocesales.ramajudicial.gov.co";
const P = "co_com_avanti_efectosProcesales_PublicacionesEfectosProcesalesPortletV2_INSTANCE_BIyXQFHVaYaq";
const HEADERS = { "User-Agent": "Mozilla/5.0 (LEXCODE)", Accept: "text/html,application/xhtml+xml,*/*" };

export type DocumentoF2 = {
  url: string;
  nombre: string;
  tipo: "individual" | "estado";
};

// La última actuación amerita documento solo si es estado o providencia (no memorial/acta/recepción).
export function ameritaDocumento(actuacion: string | null): boolean {
  const t = actuacion ?? "";
  if (/memorial|recepci[oó]n|acta\b|constancia|radicaci[oó]n/i.test(t)) return false;
  return /\bauto\b|\bsentencia\b|\bfallo\b|providencia|fijaci[oó]n\s+de?\s*estado|publicaci[oó]n\s+estado|notificaci[oó]n\s+por\s+estado/i.test(t);
}

async function fetchTexto(url: string, ms = 15000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: HEADERS, cache: "no-store", signal: ctrl.signal });
    return r.ok ? await r.text() : "";
  } finally {
    clearTimeout(t);
  }
}

function ventana(iso: string, antes = 3, despues = 25): [string, string] {
  const d = new Date(iso);
  const fi = new Date(d); fi.setDate(fi.getDate() - antes);
  const ff = new Date(d); ff.setDate(ff.getDate() + despues);
  const f = (x: Date) => x.toISOString().slice(0, 10);
  return [f(fi), f(ff)];
}

function articleIdsDe(html: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(`_${P}_articleId=(\\d+)`, "g");
  for (const m of Array.from(html.matchAll(re))) out.add(m[1]);
  return Array.from(out);
}

function docsDetalle(html: string): { url: string; nombre: string }[] {
  const out: { url: string; nombre: string }[] = [];
  const re = /href="(\/c\/document_library\/get_file\?uuid=[^"]+)"[^>]*>\s*([^<]+?\.pdf)\s*</gi;
  for (const m of Array.from(html.matchAll(re))) {
    out.push({ url: BASE + m[1].replace(/&amp;/g, "&"), nombre: m[2].trim() });
  }
  return out;
}

/**
 * Busca el documento de la última actuación en Publicaciones (F2).
 * @param radicado 23 dígitos
 * @param fechaActuacionISO fecha de la última actuación (para la ventana de búsqueda)
 * @returns DocumentoF2 (individual si casa el consecutivo; si no, el estado consolidado) o null.
 */
export async function buscarDocumento(radicado: string, fechaActuacionISO: string): Promise<DocumentoF2 | null> {
  const rad = (radicado ?? "").replace(/\D/g, "");
  if (rad.length < 21) return null;
  const idDespacho = rad.slice(0, 12);
  const consecutivo = String(parseInt(rad.slice(16, 21), 10)); // 5 díg → sin ceros

  const [fi, ff] = ventana(fechaActuacionISO);
  const urlBusqueda =
    `${BASE}/web/publicaciones-procesales/inicio?p_p_id=${P}&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view` +
    `&_${P}_action=busqueda&_${P}_idDespacho=${idDespacho}&_${P}_fechaInicio=${fi}&_${P}_fechaFin=${ff}&_${P}_verTotales=true`;
  const htmlBusqueda = await fetchTexto(urlBusqueda);
  if (!htmlBusqueda) return null;

  const articleIds = articleIdsDe(htmlBusqueda);
  let consolidado: DocumentoF2 | null = null;

  for (const aid of articleIds.slice(0, 12)) {
    const urlDet =
      `${BASE}/web/publicaciones-procesales/inicio?p_p_id=${P}&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view` +
      `&_${P}_jspPage=%2FMETA-INF%2Fresources%2Fdetail.jsp&_${P}_articleId=${aid}`;
    const html = await fetchTexto(urlDet);
    if (!html) continue;
    for (const d of docsDetalle(html)) {
      const mNum = d.nombre.match(/^(\d{4})-0*(\d{1,5})/);
      if (mNum && mNum[2] === consecutivo) return { url: d.url, nombre: d.nombre, tipo: "individual" };
      if (/^Estado\s+\d+/i.test(d.nombre) && !consolidado) consolidado = { url: d.url, nombre: d.nombre, tipo: "estado" };
    }
  }
  return consolidado; // el estado consolidado como respaldo, o null
}

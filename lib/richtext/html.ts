/**
 * Utilidades de texto enriquecido compartidas por el editor (TipTap) y los
 * generadores de export (docx/pdf). El contenido de cada sección puede ser
 * TEXTO PLANO (heredado / salida de IA) o HTML (tras edición enriquecida);
 * estas funciones tratan ambos de forma uniforme.
 */

export function esHtml(s: string | null | undefined): boolean {
  return /<\/?[a-z][\s\S]*?>/i.test(s ?? "");
}

export function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Convierte texto plano (con saltos) a HTML de párrafos (para cargar en el editor). */
export function textoPlanoAHtml(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "<p></p>";
  return t
    .split(/\n{2,}/)
    .map((par) => `<p>${escaparHtml(par).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export type Run = { text: string; bold?: boolean; italic?: boolean; underline?: boolean };
export type Parrafo = Run[];

function decodificar(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

// Convierte el contenido inline de un párrafo (con <strong>/<em>/<u>/<br>) en runs.
function parsearInline(html: string): Run[] {
  const runs: Run[] = [];
  let bold = 0, italic = 0, underline = 0;
  const re = /<(\/?)(strong|b|em|i|u|br)\b[^>]*>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[3] != null) {
      const text = decodificar(m[3]);
      if (text) runs.push({ text, bold: bold > 0 || undefined, italic: italic > 0 || undefined, underline: underline > 0 || undefined });
      continue;
    }
    const cierre = m[1] === "/";
    const tag = (m[2] || "").toLowerCase();
    if (tag === "br") { runs.push({ text: "\n" }); continue; }
    const d = cierre ? -1 : 1;
    if (tag === "strong" || tag === "b") bold += d;
    else if (tag === "em" || tag === "i") italic += d;
    else if (tag === "u") underline += d;
  }
  return runs;
}

/** Descompone el contenido (HTML o texto plano) en párrafos de runs, para exportar. */
export function htmlAParrafos(html: string | null | undefined): Parrafo[] {
  const s = (html ?? "").trim();
  if (!s) return [];
  if (!esHtml(s)) {
    return s.split(/\n{2,}/).map((par) => [{ text: par.replace(/\n/g, " ").trim() }]);
  }
  const bloques = Array.from(s.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => m[1]);
  const fuentes = bloques.length ? bloques : [s];
  return fuentes
    .map((inner) => parsearInline(inner))
    .filter((runs) => runs.some((r) => r.text.replace(/\n/g, "").trim() !== ""));
}

/** Aplana a texto plano (para exports que aún no soportan formato, o comparaciones). */
export function htmlATextoPlano(html: string | null | undefined): string {
  return htmlAParrafos(html).map((p) => p.map((r) => r.text).join("")).join("\n\n").trim();
}

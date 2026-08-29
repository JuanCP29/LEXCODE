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

/** Convierte texto plano (con saltos y **negrita** Markdown) a HTML de párrafos. */
export function textoPlanoAHtml(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  if (!t) return "<p></p>";
  return t
    .split(/\n{2,}/)
    .map((par) => {
      const esc = escaparHtml(par).replace(/\n/g, "<br>");
      const conNegrita = esc.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<p>${conNegrita}</p>`;
    })
    .join("");
}

// Convierte texto con **negrita** Markdown en runs (para exports de contenido no editado).
function parsearMarkdown(texto: string): Run[] {
  const partes = texto.split(/\*\*/);
  const runs: Run[] = [];
  partes.forEach((p, i) => { if (p) runs.push({ text: p, bold: i % 2 === 1 || undefined }); });
  return runs.length ? runs : [{ text: "" }];
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
    // Texto plano (posiblemente con **negrita** Markdown).
    return s.split(/\n{2,}/).map((par) => parsearMarkdown(par.replace(/\n/g, " ").trim()));
  }
  const bloques = Array.from(s.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => m[1]);
  const fuentes = bloques.length ? bloques : [s];
  return fuentes
    .map((inner) => parsearInline(inner))
    .filter((runs) => runs.some((r) => r.text.replace(/\n/g, "").trim() !== ""));
}

// ── Bloques de documento (párrafos + tablas + imágenes), en orden ───────────
export type BloqueDoc =
  | { tipo: "parrafo"; runs: Run[] }
  | { tipo: "tabla"; filas: Run[][][] } // filas -> celdas -> runs
  | { tipo: "imagen"; src: string; alt?: string };

function srcDe(imgTag: string): string {
  const m = imgTag.match(/src\s*=\s*["']([^"']+)["']/i);
  return m ? decodificar(m[1]) : "";
}

/** Descompone el contenido en bloques ordenados (párrafos, tablas, imágenes) para exportar. */
export function htmlABloques(html: string | null | undefined): BloqueDoc[] {
  const s = (html ?? "").trim();
  if (!s) return [];
  if (!esHtml(s)) {
    return s.split(/\n{2,}/).map((par) => ({ tipo: "parrafo", runs: parsearMarkdown(par.replace(/\n/g, " ").trim()) }));
  }
  const bloques: BloqueDoc[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>|<table\b[^>]*>([\s\S]*?)<\/table>|(<img\b[^>]*>)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m[1] != null) {
      // Un párrafo puede contener una imagen inline (TipTap la deja dentro de <p>).
      const img = m[1].match(/<img\b[^>]*>/i);
      const runs = parsearInline(m[1]);
      if (runs.some((r) => r.text.replace(/\n/g, "").trim() !== "")) bloques.push({ tipo: "parrafo", runs });
      if (img) { const src = srcDe(img[0]); if (src) bloques.push({ tipo: "imagen", src }); }
    } else if (m[2] != null) {
      const filas: Run[][][] = [];
      const trs = Array.from(m[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map((x) => x[1]);
      for (const tr of trs) {
        const celdas = Array.from(tr.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)).map((x) => parsearInline(x[1]));
        if (celdas.length) filas.push(celdas);
      }
      if (filas.length) bloques.push({ tipo: "tabla", filas });
    } else if (m[3] != null) {
      const src = srcDe(m[3]);
      if (src) bloques.push({ tipo: "imagen", src });
    }
  }
  if (!bloques.length) bloques.push({ tipo: "parrafo", runs: parsearInline(s) });
  return bloques;
}

/** URLs de las imágenes incrustadas, en orden (para precargarlas antes de exportar). */
export function extraerImagenes(html: string | null | undefined): string[] {
  return htmlABloques(html).flatMap((b) => (b.tipo === "imagen" ? [b.src] : []));
}

/** Aplana a texto plano (para exports que aún no soportan formato, o comparaciones). */
export function htmlATextoPlano(html: string | null | undefined): string {
  return htmlABloques(html)
    .map((b) => b.tipo === "parrafo"
      ? b.runs.map((r) => r.text).join("")
      : b.tipo === "tabla"
      ? b.filas.map((fila) => fila.map((celda) => celda.map((r) => r.text).join("")).join("  |  ")).join("\n")
      : "") // imagen -> sin texto
    .filter((t) => t !== "")
    .join("\n\n")
    .trim();
}

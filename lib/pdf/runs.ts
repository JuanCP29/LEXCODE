import type PDFDocument from "pdfkit";
import { htmlABloques, type Run } from "@/lib/richtext/html";

type Doc = InstanceType<typeof PDFDocument>;

function fuente(bold?: boolean, italic?: boolean): string {
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}

/** Dibuja una tabla (rejilla con bordes) en el PDF, columnas de ancho igual. */
export function dibujarTablaPdf(
  doc: Doc,
  filas: Run[][][],
  opts: { x: number; width: number; size?: number; font?: string; fontBold?: string; bottom?: number; top?: number }
): void {
  const cols = Math.max(1, ...filas.map((f) => f.length));
  const colW = opts.width / cols;
  const size = opts.size ?? 9;
  const FONT = opts.font ?? "Helvetica";
  const FONT_BOLD = opts.fontBold ?? "Helvetica-Bold";
  const padX = 4, padY = 3;

  for (let ri = 0; ri < filas.length; ri++) {
    const fila = filas[ri];
    const textos: string[] = [];
    let rowH = 0;
    for (let ci = 0; ci < cols; ci++) {
      const txt = (fila[ci] ?? []).map((r) => r.text).join("").trim();
      textos.push(txt);
      doc.font(ri === 0 ? FONT_BOLD : FONT).fontSize(size);
      rowH = Math.max(rowH, doc.heightOfString(txt || " ", { width: colW - padX * 2 }));
    }
    rowH += padY * 2;
    if (opts.bottom && doc.y + rowH > opts.bottom) { doc.addPage(); doc.y = opts.top ?? doc.page.margins.top; }
    const y = doc.y;
    for (let ci = 0; ci < cols; ci++) {
      const cx = opts.x + ci * colW;
      doc.rect(cx, y, colW, rowH).stroke("9AA5B1");
      doc.font(ri === 0 ? FONT_BOLD : FONT).fontSize(size).fillColor("0F1117")
        .text(textos[ci] || "", cx + padX, y + padY, { width: colW - padX * 2 });
    }
    doc.y = y + rowH;
    doc.x = opts.x;
  }
  doc.fillColor("0F1117");
}

/**
 * Renderiza contenido (HTML enriquecido o texto plano) en un PDFKit doc,
 * respetando negrita / cursiva / subrayado. Un párrafo por bloque.
 */
export function renderContenidoPdf(
  doc: Doc,
  contenido: string | null | undefined,
  opts: { size?: number; align?: "center" | "justify" | "left"; lineGap?: number; espacioParrafo?: number } = {}
): void {
  const bloques = htmlABloques(contenido);
  const size = opts.size ?? 11;
  const align = (opts.align ?? "justify") as "center" | "justify" | "left";

  if (bloques.length === 0) { doc.moveDown(0.4); return; }

  for (const b of bloques) {
    if (b.tipo === "tabla") {
      const m = doc.page.margins;
      dibujarTablaPdf(doc, b.filas, {
        x: m.left,
        width: doc.page.width - m.left - m.right,
        size,
        bottom: doc.page.height - m.bottom,
        top: m.top,
      });
      doc.x = m.left;
      doc.moveDown(opts.espacioParrafo ?? 0.4);
      continue;
    }
    const runs = b.runs;
    runs.forEach((r, i) => {
      const ultimo = i === runs.length - 1;
      doc.font(fuente(r.bold, r.italic)).fontSize(size).text(r.text.replace(/\n/g, " "), {
        continued: !ultimo,
        underline: !!r.underline,
        align,
        lineGap: opts.lineGap ?? 2,
      });
    });
    doc.moveDown(opts.espacioParrafo ?? 0.4);
  }
}

import type PDFDocument from "pdfkit";
import { htmlABloques } from "@/lib/richtext/html";

type Doc = InstanceType<typeof PDFDocument>;

function fuente(bold?: boolean, italic?: boolean): string {
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
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
      // Por ahora la tabla se muestra como filas de texto (celdas separadas por " | ").
      b.filas.forEach((fila, ri) => {
        const linea = fila.map((celda) => celda.map((r) => r.text).join("")).join("   |   ");
        doc.font(ri === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(size).text(linea, { align: "left", lineGap: opts.lineGap ?? 2 });
      });
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

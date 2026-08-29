import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from "docx";
import { htmlAParrafos, htmlABloques, type Run } from "@/lib/richtext/html";

type Opts = {
  size?: number;
  color?: string;
  font?: string;
  align?: "center" | "justify" | "left";
  spacingAfter?: number;
  line?: number;
  vacio?: string; // texto si el contenido está vacío
};

function runsDeParrafo(runs: Run[], opts: Opts): Paragraph {
  const align = opts.align === "center" ? AlignmentType.CENTER
    : opts.align === "justify" ? AlignmentType.JUSTIFIED
    : AlignmentType.LEFT;
  return new Paragraph({
    alignment: align,
    spacing: { after: opts.spacingAfter ?? 120, line: opts.line },
    children: runs.flatMap((r) => {
      const partes = r.text.split("\n");
      return partes.map((t, i) => new TextRun({
        text: t,
        bold: r.bold,
        italics: r.italic,
        underline: r.underline ? {} : undefined,
        size: opts.size,
        color: opts.color,
        font: opts.font,
        break: i > 0 ? 1 : undefined,
      }));
    }),
  });
}

/**
 * Convierte contenido (HTML enriquecido o texto plano) en párrafos de Word,
 * respetando negrita / cursiva / subrayado. (Solo párrafos; no incluye tablas.)
 */
export function parrafosDocx(contenido: string | null | undefined, opts: Opts = {}): Paragraph[] {
  const pars = htmlAParrafos(contenido);
  if (pars.length === 0) {
    return [runsDeParrafo([{ text: opts.vacio ?? "" }], opts)];
  }
  return pars.map((runs) => runsDeParrafo(runs, opts));
}

/**
 * Convierte contenido en bloques de Word (párrafos Y tablas reales), en orden.
 * Devuelve una mezcla de Paragraph y Table para insertar en la sección.
 */
export function bloquesDocx(contenido: string | null | undefined, opts: Opts = {}): (Paragraph | Table)[] {
  const bloques = htmlABloques(contenido);
  if (bloques.length === 0) return [runsDeParrafo([{ text: opts.vacio ?? "" }], opts)];

  const borde = { style: BorderStyle.SINGLE, size: 2, color: "9AA5B1" };
  return bloques.map((b) => {
    if (b.tipo === "parrafo") return runsDeParrafo(b.runs, opts);
    // Tabla
    const filas = b.filas.map((fila, ri) => new TableRow({
      children: fila.map((celda) => new TableCell({
        borders: { top: borde, bottom: borde, left: borde, right: borde },
        margins: { top: 40, bottom: 40, left: 80, right: 80 },
        children: [new Paragraph({
          spacing: { after: 0 },
          children: (celda.length ? celda : [{ text: "" }]).flatMap((r) =>
            r.text.split("\n").map((t, i) => new TextRun({
              text: t, bold: ri === 0 ? true : r.bold, italics: r.italic,
              underline: r.underline ? {} : undefined, size: opts.size, font: opts.font, color: opts.color,
              break: i > 0 ? 1 : undefined,
            }))),
        })],
      })),
    }));
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas });
  });
}

import { Paragraph, TextRun, AlignmentType } from "docx";
import { htmlAParrafos } from "@/lib/richtext/html";

type Opts = {
  size?: number;
  color?: string;
  font?: string;
  align?: "center" | "justify" | "left";
  spacingAfter?: number;
  line?: number;
  vacio?: string; // texto si el contenido está vacío
};

/**
 * Convierte contenido (HTML enriquecido o texto plano) en párrafos de Word,
 * respetando negrita / cursiva / subrayado. Los <br> se vuelven saltos de línea.
 */
export function parrafosDocx(contenido: string | null | undefined, opts: Opts = {}): Paragraph[] {
  const pars = htmlAParrafos(contenido);
  const align = opts.align === "center" ? AlignmentType.CENTER
    : opts.align === "justify" ? AlignmentType.JUSTIFIED
    : AlignmentType.LEFT;

  if (pars.length === 0) {
    return [new Paragraph({
      alignment: align,
      spacing: { after: opts.spacingAfter ?? 120, line: opts.line },
      children: [new TextRun({ text: opts.vacio ?? "", size: opts.size, color: opts.color, font: opts.font })],
    })];
  }

  return pars.map((runs) => new Paragraph({
    alignment: align,
    spacing: { after: opts.spacingAfter ?? 120, line: opts.line },
    children: runs.flatMap((r) => {
      const partes = r.text.split("\n");
      return partes.flatMap((t, i) => {
        const run = new TextRun({
          text: t,
          bold: r.bold,
          italics: r.italic,
          underline: r.underline ? {} : undefined,
          size: opts.size,
          color: opts.color,
          font: opts.font,
          break: i > 0 ? 1 : undefined,
        });
        return [run];
      });
    }),
  }));
}

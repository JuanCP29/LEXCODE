import { Document, Packer, Paragraph, Table, TextRun, AlignmentType } from "docx";
import { construirBloquesContestacion, type DatosContestacion } from "@/lib/contestacion/contenido";
import { bloquesDocx } from "@/lib/docx/runs";

const FUENTE = "Arial";

export async function generarContestacionDocx(datos: DatosContestacion): Promise<Buffer> {
  const bloques = construirBloquesContestacion(datos);

  const parrafos: (Paragraph | Table)[] = bloques.flatMap((b) => {
    if (b.t === "sp") return [new Paragraph({ children: [], spacing: { after: 120 } })];

    if (b.t === "rich") {
      return bloquesDocx(b.contenido, { size: 22, font: FUENTE, align: "justify", line: 300, vacio: "—" });
    }

    if (b.t === "h") {
      return [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 120 },
        children: [new TextRun({ text: b.texto, bold: true, font: FUENTE, size: 22 })],
      })];
    }

    if (b.t === "ref") {
      return [new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: `${b.label}  `, bold: true, font: FUENTE, size: 22 }),
          new TextRun({ text: b.valor, font: FUENTE, size: 22 }),
        ],
      })];
    }

    // párrafo
    return [new Paragraph({
      alignment: b.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      spacing: { after: 120, line: 300 },
      children: [new TextRun({ text: b.texto, bold: b.bold, font: FUENTE, size: 22 })],
    })];
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: FUENTE, size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1418, right: 1418 } } },
      children: parrafos,
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

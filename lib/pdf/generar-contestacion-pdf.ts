import PDFDocument from "pdfkit";
import { construirBloquesContestacion, type DatosContestacion } from "@/lib/contestacion/contenido";
import { renderContenidoPdf } from "@/lib/pdf/runs";

/** Contestación de la Demanda en PDF (texto corrido, estilo memorial jurídico). */
export function generarContestacionPdf(datos: DatosContestacion): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const bloques = construirBloquesContestacion(datos);
      const doc = new PDFDocument({ size: "LETTER", margins: { top: 72, bottom: 72, left: 85, right: 85 } });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      for (const b of bloques) {
        if (b.t === "sp") { doc.moveDown(0.6); continue; }

        if (b.t === "h") {
          doc.moveDown(0.4);
          doc.font("Helvetica-Bold").fontSize(11).text(b.texto, { width: ancho, align: "center" });
          doc.moveDown(0.3);
          continue;
        }

        if (b.t === "ref") {
          const y = doc.y;
          doc.font("Helvetica-Bold").fontSize(11).text(b.label, doc.page.margins.left, y, { continued: true });
          doc.font("Helvetica").text(`  ${b.valor}`);
          doc.moveDown(0.15);
          continue;
        }

        if (b.t === "rich") {
          renderContenidoPdf(doc, b.contenido, { size: 11, align: "justify", lineGap: 2 });
          continue;
        }

        doc.font(b.bold ? "Helvetica-Bold" : "Helvetica").fontSize(11)
          .text(b.texto, { width: ancho, align: b.center ? "center" : "justify", lineGap: 2 });
        doc.moveDown(0.4);
      }

      doc.end();
    } catch (e) {
      reject(e instanceof Error ? e : new Error("Error al generar el PDF"));
    }
  });
}

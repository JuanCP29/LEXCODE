/**
 * Rellena el template oficial DOCX de la Ficha de Conciliación
 * (GDJ-GPO-FMT-005 v2) preservando el formato original.
 *
 * El template en public/plantillas/FICHA_CONCILIACION_TEMPLATE.docx
 * contiene placeholders {campo} insertados en las posiciones exactas
 * de los campos coloreados del modelo oficial.
 */
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export type DatosFichaDocx = {
  fecha_diligencia: string;
  radicado_bizagi: string;
  radicado: string;
  nombre_demandante: string;
  expediente_pensional: string;
  autoridad_citacion: string;
  caducidad: string;
  // sec_1 ... sec_19
  [key: `sec_${number}`]: string;
};

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "public",
  "plantillas",
  "FICHA_CONCILIACION_TEMPLATE.docx"
);

export function templateDocxDisponible(): boolean {
  return fs.existsSync(TEMPLATE_PATH);
}

export function rellenarTemplateDocx(datos: Partial<DatosFichaDocx>): Buffer {
  const contenido = fs.readFileSync(TEMPLATE_PATH);
  const zip = new PizZip(contenido);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true, // convierte \n del contenido en saltos de línea Word
    nullGetter: () => "", // placeholders sin dato → vacío, nunca texto inventado
  });

  // Normalizar: todo string, sin undefined
  const data: Record<string, string> = {};
  const campos = [
    "fecha_diligencia", "radicado_bizagi", "radicado", "nombre_demandante",
    "expediente_pensional", "autoridad_citacion", "caducidad",
    ...Array.from({ length: 19 }, (_, i) => `sec_${i + 1}`),
  ];
  for (const campo of campos) {
    const valor = (datos as Record<string, unknown>)[campo];
    data[campo] = valor != null ? String(valor) : "";
  }

  doc.render(data);

  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

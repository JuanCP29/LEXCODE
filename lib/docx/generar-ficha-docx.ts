import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from "docx";
import { SECCIONES } from "@/lib/ia/secciones";
import { bloquesDocx } from "@/lib/docx/runs";

// Colores institucionales
const AZUL       = "185FA5";
const GRIS_HEADER= "F1F5F9";
const NEGRO      = "0F1117";

const DEMANDADO_DEFAULT = "Administradora Colombiana de Pensiones — COLPENSIONES. NIT 900.336.004-7";

interface DatosFicha {
  // Datos del caso
  radicado: string;
  radicado_bizagi: string | null;
  nombre_demandante: string;
  cedula_demandante: string | null;
  expediente_pensional: string | null;
  despacho: string | null;
  jurisdiccion: string | null;

  // Encabezado formato v3
  causante_afiliado: string | null;
  demandado: string | null;
  juez: string | null;
  reconsideracion: string | null;
  caducidad: string | null;
  fecha_diligencia: string | null;

  // Parámetros
  tipo_conciliacion: string | null;
  conciliable: boolean | null;
  directriz_conciliacion: string | null;
  pretension: string | null;
  clase_pretension: string | null;
  resolucion_prestacion: string | null;
  semanas_cotizadas: number | null;
  tasa_aplicada: number | null;
  tasa_solicitada: number | null;
  cuantia_tipo: string | null;
  cuantia_valor: number | null;
  pretende_intereses: boolean | null;
  pretende_indexacion: boolean | null;
  hay_fallo: boolean | null;

  // 19 secciones
  sec_1_hechos: string | null;
  sec_2_pretensiones: string | null;
  sec_3_cuantia: string | null;
  sec_4_normas: string | null;
  sec_5_apelacion: string | null;
  sec_6_sentencia: string | null;
  sec_7_probatorio: string | null;
  sec_8_problema: string | null;
  sec_9_caducidad: string | null;
  sec_10_movimientos: string | null;
  sec_11_jurisprudencia: string | null;
  sec_12_doctrina: string | null;
  sec_13_comite_ext: string | null;
  sec_14_casos_similares: string | null;
  sec_15_politicas: string | null;
  sec_16_consideraciones: string | null;
  sec_17_riesgo: string | null;
  sec_18_recomendacion: string | null;
  sec_19_elaboro: string | null;

  // Abogado que elaboró
  abogado_nombre: string | null;
  abogado_cedula: string | null;
  abogado_tarjeta: string | null;

  fecha_elaboracion?: string;
}

function celdaHeader(texto: string): TableCell {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, color: GRIS_HEADER, fill: GRIS_HEADER },
    children: [new Paragraph({
      children: [new TextRun({ text: texto, bold: true, size: 18, color: NEGRO })],
    })],
  });
}

function celdaValor(texto: string): TableCell {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text: texto || "—", size: 18, color: NEGRO })],
    })],
  });
}

function filaDatos(label: string, valor: string): TableRow {
  return new TableRow({
    children: [celdaHeader(label), celdaValor(valor)],
  });
}

function tituloCampo(texto: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: texto, bold: true, size: 20, color: AZUL })],
    spacing: { before: 240, after: 80 },
  });
}


function separador(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" } },
    spacing: { before: 160, after: 160 },
    children: [],
  });
}

export async function generarFichaDocx(datos: DatosFicha): Promise<Buffer> {
  const fechaStr = datos.fecha_elaboracion
    ? new Date(datos.fecha_elaboracion).toLocaleDateString("es-CO")
    : new Date().toLocaleDateString("es-CO");

  const doc = new Document({
    creator: "FoQs — Collegia Abogados",
    title: `Ficha de Conciliación — ${datos.radicado}`,
    sections: [{
      children: [
        // ── Encabezado ──────────────────────────────────────────────────────
        new Paragraph({
          children: [
            new TextRun({ text: "FoQs", bold: true, size: 28, color: AZUL }),
            new TextRun({ text: "  |  Collegia Abogados  |  ", size: 20, color: "64748B" }),
            new TextRun({ text: "GDJ-GPO-FMT-005  v3", size: 20, color: "64748B" }),
          ],
          alignment: AlignmentType.LEFT,
          spacing: { after: 80 },
        }),

        // ── Título ────────────────────────────────────────────────────────
        new Paragraph({
          children: [
            new TextRun({
              text: "FICHA DE CONCILIACIÓN JUDICIAL",
              bold: true,
              size: 28,
              color: AZUL,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 80 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "Código GDJ-GPO-FMT-005 · Versión 3 — Colpensiones",
              size: 18,
              color: "64748B",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 320 },
        }),

        // ── Tabla encabezado (formato v3) ─────────────────────────────────
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            filaDatos("Fecha de la diligencia",
              datos.fecha_diligencia ? new Date(datos.fecha_diligencia).toLocaleDateString("es-CO") : "—"),
            filaDatos("Radicado de demanda en Bizagi",  datos.radicado_bizagi ?? "—"),
            filaDatos("Radicado del proceso (23 dígitos)", datos.radicado),
            filaDatos("Nombre e identificación demandante",
              [datos.nombre_demandante, datos.cedula_demandante ? `C.C. ${datos.cedula_demandante}` : ""].filter(Boolean).join(". ")),
            filaDatos("Nombre e identificación causante y/o afiliado", datos.causante_afiliado ?? "—"),
            filaDatos("Nombre e identificación demandado",  datos.demandado || DEMANDADO_DEFAULT),
            filaDatos("Autoridad que realiza la citación",
              [datos.despacho, datos.juez].filter(Boolean).join(" — ") || "—"),
            filaDatos("Caducidad",        datos.caducidad ?? "—"),
            filaDatos("Reconsideración",  datos.reconsideracion ?? "—"),
          ],
        }),

        separador(),

        // ── Bloque paramétrico ────────────────────────────────────────────
        tituloCampo("PARÁMETROS DE CONCILIACIÓN"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            filaDatos("¿Asunto conciliable?",   datos.conciliable ? "Sí" : "No"),
            filaDatos("Directriz aplicada",      datos.directriz_conciliacion ?? "—"),
            filaDatos("Pretensión",              datos.pretension ?? "—"),
            filaDatos("Clase de pretensión",     datos.clase_pretension ?? "—"),
            filaDatos("Resolución prestación",   datos.resolucion_prestacion ?? "—"),
            filaDatos("Semanas cotizadas",       datos.semanas_cotizadas?.toString() ?? "—"),
            filaDatos("Tasa aplicada",           datos.tasa_aplicada != null ? `${datos.tasa_aplicada}%` : "—"),
            filaDatos("Tasa solicitada",         datos.tasa_solicitada != null ? `${datos.tasa_solicitada}%` : "—"),
            filaDatos("Cuantía",                 datos.cuantia_tipo === "determinada" && datos.cuantia_valor
              ? `Determinada — $${datos.cuantia_valor.toLocaleString("es-CO")}`
              : "Indeterminada"),
            filaDatos("Intereses moratorios",    datos.pretende_intereses ? "Sí" : "No"),
            filaDatos("Indexación",              datos.pretende_indexacion ? "Sí" : "No"),
            filaDatos("Fallo primera instancia", datos.hay_fallo ? "Sí" : "No"),
          ],
        }),

        separador(),

        // ── 19 Secciones ──────────────────────────────────────────────────
        tituloCampo("SECCIONES DE LA FICHA"),
        ...SECCIONES.flatMap((s) => {
          const contenido = s.textoFijo ?? ((datos as unknown as Record<string, string | null>)[s.key] ?? "");
          return [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${s.numero}. ${s.label.toUpperCase()}`,
                  bold: true,
                  size: 20,
                  color: AZUL,
                }),
                new TextRun({
                  text: `  [${s.tipo}]`,
                  size: 16,
                  color: s.tipo === "AUTO" ? "3B6D11" : s.tipo === "DEFAULT" ? "185FA5" : "854F0B",
                }),
              ],
              spacing: { before: 280, after: 80 },
            }),
            ...bloquesDocx(contenido, {
              size: 18,
              color: NEGRO,
              align: s.centrado ? "center" : "left",
              spacingAfter: 120,
              vacio: "Pendiente de diligenciar.",
            }),
          ];
        }),

        separador(),

        // ── Firma ─────────────────────────────────────────────────────────
        tituloCampo("ELABORÓ"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            filaDatos("Nombre",             datos.abogado_nombre ?? "—"),
            filaDatos("Cédula",             datos.abogado_cedula ?? "—"),
            filaDatos("Tarjeta profesional",datos.abogado_tarjeta ?? "—"),
            filaDatos("Fecha",              fechaStr),
          ],
        }),

        new Paragraph({
          children: [
            new TextRun({
              text: "\nDocumento generado por FoQs — Collegia Abogados",
              size: 16,
              color: "94A3B8",
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 480 },
        }),
      ],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

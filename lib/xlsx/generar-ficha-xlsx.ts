import ExcelJS from "exceljs";

export interface DatosFichaXlsx {
  // Encabezado — campos parametricos
  tipo_conciliacion: string;               // "parametrica" | "condicional"
  fecha_diligencia: string | null;         // ABIERTO PARA FECHAS
  // Encabezado — traer de base (azul)
  radicado_bizagi: string;                 // NO_BIZAGI
  radicado: string;                        // DIGITOS_23
  nombre_demandante: string;               // NOMBRE_DEMANDANTE
  // Encabezado — parametricos
  expediente_pensional_aplica: string;     // SI / NO / NO APLICA
  despacho: string;                        // NOMBRE_DESPACHO_INICIAL
  caducidad: string;                       // SI / NO / NO APLICA
  // 19 secciones
  sec_1:  string; sec_2:  string; sec_3:  string; sec_4:  string;
  sec_5:  string; sec_6:  string; sec_7:  string; sec_8:  string;
  sec_9:  string; sec_10: string; sec_11: string; sec_12: string;
  sec_13: string; sec_14: string; sec_15: string; sec_16: string;
  sec_17: string; sec_18: string; sec_19: string;
}

// Texto legal completo para TIPO DE CONCILIACIÓN
function textTipoConciliacion(tipo: string): string {
  const prefijo = tipo === "condicional" ? "CONDICIONAL" : "PARAMÉTRICA";
  return `${prefijo} – (JUDICIAL: CONCILIACIÓN JUDICIAL – ART 77 DEL C.P.T Y S.S)`;
}

// Mapa: celda → función que devuelve el valor a insertar
const MAPA: [string, (d: DatosFichaXlsx) => string][] = [
  // ── Encabezado ──────────────────────────────────────────────────────
  ["C8",  (d) => textTipoConciliacion(d.tipo_conciliacion)],
  ["C9",  (d) => d.fecha_diligencia
              ? new Date(d.fecha_diligencia).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" })
              : ""],
  ["C10", (d) => d.radicado_bizagi || "—"],
  ["C11", (d) => d.radicado || "—"],
  ["C12", (d) => d.nombre_demandante || "—"],
  ["C13", (d) => d.expediente_pensional_aplica || "—"],
  ["C14", (d) => d.despacho || "—"],
  ["C15", (d) => d.caducidad || "—"],
  // ── 19 secciones (fila contenido = fila etiqueta + 1) ────────────────
  ["B19", (d) => d.sec_1],
  ["B21", (d) => d.sec_2],
  ["B23", (d) => d.sec_3],
  ["B25", (d) => d.sec_4],
  ["B27", (d) => d.sec_5],
  ["B29", (d) => d.sec_6],
  ["B31", (d) => d.sec_7],
  ["B33", (d) => d.sec_8],
  ["B35", (d) => d.sec_9],
  ["B37", (d) => d.sec_10],
  ["B39", (d) => d.sec_11],
  ["B41", (d) => d.sec_12],
  ["B43", (d) => d.sec_13],
  ["B45", (d) => d.sec_14],
  ["B47", (d) => d.sec_15],
  ["B49", (d) => d.sec_16],
  ["B51", (d) => d.sec_17],
  ["B53", (d) => d.sec_18],
  ["B55", (d) => d.sec_19],
];

export async function generarFichaXlsx(
  templateBuffer: Buffer,
  datos: DatosFichaXlsx
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(templateBuffer as any);

  const ws = wb.getWorksheet("Formato");
  if (!ws) throw new Error("Hoja 'Formato' no encontrada en la plantilla");

  for (const [addr, getFn] of MAPA) {
    const celda = ws.getCell(addr);
    const valor = getFn(datos);

    celda.value = valor || "—";
    celda.alignment = { wrapText: true, vertical: "top" };

    // Fuente: negro normal para valores rellenados
    if (celda.font) {
      celda.font = { ...celda.font, bold: false, color: { argb: "FF0F1117" }, italic: false };
    } else {
      celda.font = { name: "Calibri", size: 11, bold: false, color: { argb: "FF0F1117" } };
    }
  }

  // Ajustar altura de filas de contenido
  const filasContenido = [9, 10, 11, 12, 13, 14, 15, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55];
  for (const n of filasContenido) {
    const row = ws.getRow(n);
    if (!row.height || row.height < 30) row.height = 55;
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

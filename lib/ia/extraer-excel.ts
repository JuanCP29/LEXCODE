import * as XLSX from "xlsx";

export interface DatosExcel {
  radicado?: string;
  nombre_demandante?: string;
  cedula_demandante?: string;
  despacho?: string;
  pretension?: string;
  clase_pretension?: string;
  semanas_cotizadas?: string;
  resolucion?: string;
  [key: string]: string | undefined;
}

export function extraerDatosExcel(buffer: Buffer): DatosExcel {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  const filas: string[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });

  const datos: DatosExcel = {};

  // Mapeo flexible: busca pares clave-valor en columnas A-B
  for (const fila of filas) {
    if (fila.length >= 2) {
      const clave = String(fila[0]).toLowerCase().trim();
      const valor = String(fila[1]).trim();
      if (!valor) continue;

      if (clave.includes("radicado"))            datos.radicado = valor;
      else if (clave.includes("demandante"))     datos.nombre_demandante = valor;
      else if (clave.includes("cédula") || clave.includes("cedula")) datos.cedula_demandante = valor;
      else if (clave.includes("despacho"))       datos.despacho = valor;
      else if (clave.includes("pretensión") || clave.includes("pretension")) datos.pretension = valor;
      else if (clave.includes("clase"))          datos.clase_pretension = valor;
      else if (clave.includes("semanas"))        datos.semanas_cotizadas = valor;
      else if (clave.includes("resolución") || clave.includes("resolucion")) datos.resolucion = valor;
      else datos[clave] = valor;
    }
  }

  return datos;
}

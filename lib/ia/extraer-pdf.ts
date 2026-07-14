import { PDFParse } from "pdf-parse";
import { existsSync } from "node:fs";
import path from "node:path";

let workerConfigurado = false;

function configurarWorker() {
  if (workerConfigurado) return;

  // En desarrollo el worker vive bajo process.cwd(). En un bundle serverless,
  // pdf-parse puede quedar reubicado; resolver también desde su entrypoint hace
  // que la búsqueda sea independiente del directorio de trabajo de la función.
  const rutasCandidatas = [
    path.resolve(process.cwd(), "node_modules/pdf-parse/dist/worker/pdf.worker.mjs"),
    path.resolve(path.dirname(require.resolve("pdf-parse")), "../../worker/pdf.worker.mjs"),
  ];
  const workerPath = rutasCandidatas.find((ruta) => existsSync(ruta));

  if (!workerPath) {
    throw new Error(
      `No se encontró el worker de pdf-parse. Rutas verificadas: ${rutasCandidatas.join(", ")}`
    );
  }

  PDFParse.setWorker(workerPath);
  workerConfigurado = true;
}

export async function extraerTextoPDF(buffer: Buffer): Promise<string> {
  configurarWorker();
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.trim();
  } finally {
    await parser.destroy();
  }
}

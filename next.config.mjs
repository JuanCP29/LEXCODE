const pdfRuntimeFiles = [
  "./node_modules/pdf-parse/dist/worker/pdf.worker.mjs",
  "./node_modules/@napi-rs/canvas/**/*",
  "./node_modules/@napi-rs/canvas-*/**/*",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@napi-rs/canvas", "xlsx", "exceljs", "pdfkit"],
    outputFileTracingIncludes: {
      "/api/documentos-caso": pdfRuntimeFiles,
      "/api/documentos-caso/[id]/reprocesar": pdfRuntimeFiles,
      "/api/regenerar-seccion": pdfRuntimeFiles,
      "/api/directrices": pdfRuntimeFiles,
      "/api/analizar-documentos-extra": pdfRuntimeFiles,
    },
  },
};

export default nextConfig;

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Sheet,
  FileDown,
  Zap,
  Calendar,
  Hash,
  User,
  Building2,
  Scale,
  Gavel,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { estadoBadgeClases } from "@/lib/ui/estado-badge";

// ── Labels ────────────────────────────────────────────────────────────────────
const PRETENSION_LABEL: Record<string, string> = {
  vejez:          "Pensión de Vejez",
  invalidez:      "Pensión de Invalidez",
  sobrevivientes: "Pensión de Sobrevivientes",
  indemnizacion:  "Indemnización Sustitutiva",
  devolucion:     "Devolución de Saldos",
};

const JURISDICCION_LABEL: Record<string, string> = {
  ordinaria:    "Ordinaria Laboral",
  contencioso:  "Contencioso Administrativo",
};

const TIPO_ARCHIVO_LABEL: Record<string, string> = {
  demanda_pdf:   "Demanda",
  excel_proceso: "Movimientos",
  lineamientos:  "Lineamientos",
};

// ── Signed URLs para descarga ─────────────────────────────────────────────────
async function getSignedUrl(
  supabase: ReturnType<typeof createClient>,
  path: string
): Promise<string | null> {
  const { data } = await supabase.storage
    .from("documentos-lexcode")
    .createSignedUrl(path, 60 * 60); // 1 hora
  return data?.signedUrl ?? null;
}

// ── Página ────────────────────────────────────────────────────────────────────
export default async function CasoDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  // Cargar caso, fichas y archivos en paralelo
  const [{ data: caso }, { data: fichas }, { data: archivos }] =
    await Promise.all([
      supabase.from("casos").select("*").eq("id", params.id).single(),
      supabase
        .from("fichas_conciliacion")
        .select("id, estado, created_at, docx_url")
        .eq("caso_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("archivos_proceso")
        .select("id, tipo, storage_path, nombre_original, created_at")
        .eq("caso_id", params.id)
        .order("created_at", { ascending: true }),
    ]);

  if (!caso) notFound();

  // Generar signed URLs para cada archivo
  const archivosConUrl = await Promise.all(
    (archivos ?? []).map(async (a) => ({
      ...a,
      url: await getSignedUrl(supabase, a.storage_path),
    }))
  );

  const tieneFichas = fichas && fichas.length > 0;

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Volver ──────────────────────────────────────────────────────── */}
      <Link
        href="/casos"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a casos
      </Link>

      {/* ── Hero del caso ────────────────────────────────────────────────── */}
      <div className="bg-[#1a1d27] rounded-xl border border-[#2d3148] p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Badge estado */}
            <span
              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold mb-3 ${estadoBadgeClases(caso.estado)}`}
            >
              {caso.estado}
            </span>

            <h1 className="text-xl font-bold text-white font-mono break-all">
              {caso.radicado}
            </h1>
            <p className="text-gray-400 mt-1 text-sm">{caso.nombre_demandante}</p>

            {caso.pretension && (
              <p className="text-xs text-[#6b7dff] mt-2 font-medium">
                {PRETENSION_LABEL[caso.pretension] ?? caso.pretension}
                {caso.clase_pretension && (
                  <span className="text-gray-500"> — {caso.clase_pretension}</span>
                )}
              </p>
            )}
          </div>

          {/* Botón principal */}
          <Link
            href={`/generador/${caso.id}/params`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#6b7dff] hover:bg-[#5a6cf0] text-white text-sm font-semibold transition-colors shrink-0 self-start"
          >
            <Zap className="w-4 h-4" />
            {tieneFichas ? "Nueva ficha" : "Generar ficha"}
          </Link>
        </div>
      </div>

      {/* ── Grid principal ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Datos del proceso */}
        <div className="bg-[#1a1d27] rounded-xl border border-[#2d3148]">
          <div className="px-5 py-4 border-b border-[#2d3148]">
            <h2 className="text-sm font-semibold text-white">Datos del proceso</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            <DatoFila
              icon={Hash}
              label="Radicado Bizagi"
              value={caso.radicado_bizagi}
              mono
            />
            <DatoFila icon={User}     label="Cédula"              value={caso.cedula_demandante} mono />
            <DatoFila icon={FileText} label="Expediente pensional" value={caso.expediente_pensional} mono />
            <DatoFila icon={Building2}label="Despacho"            value={caso.despacho} />
            <DatoFila
              icon={Scale}
              label="Jurisdicción"
              value={caso.jurisdiccion ? (JURISDICCION_LABEL[caso.jurisdiccion] ?? caso.jurisdiccion) : null}
            />
            <DatoFila icon={Gavel}    label="Pretensión"          value={caso.pretension ? PRETENSION_LABEL[caso.pretension] : null} />
            <DatoFila icon={Gavel}    label="Clase"               value={caso.clase_pretension} />
            <DatoFila icon={Calendar} label="Registrado"          value={formatDate(caso.created_at)} />
          </div>
        </div>

        {/* Columna derecha */}
        <div className="space-y-4">

          {/* Archivos del proceso */}
          <div className="bg-[#1a1d27] rounded-xl border border-[#2d3148]">
            <div className="px-5 py-4 border-b border-[#2d3148]">
              <h2 className="text-sm font-semibold text-white">Documentos del proceso</h2>
            </div>

            {archivosConUrl.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-gray-500">Sin archivos cargados</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#2d3148]">
                {archivosConUrl.map((a) => {
                  const esExcel = a.tipo === "excel_proceso";
                  const Icon = esExcel ? Sheet : FileText;
                  const iconColor = esExcel ? "text-green-400" : "text-red-400";

                  return (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3.5">
                      <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{a.nombre_original}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {TIPO_ARCHIVO_LABEL[a.tipo] ?? a.tipo} · {formatDate(a.created_at)}
                        </p>
                      </div>
                      {a.url ? (
                        <a
                          href={a.url}
                          download={a.nombre_original}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2d3148] hover:bg-[#3a3f5c] text-xs text-gray-300 hover:text-white transition-colors shrink-0"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          Descargar
                        </a>
                      ) : (
                        <span className="text-xs text-gray-600 shrink-0">No disponible</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Fichas generadas */}
          <div className="bg-[#1a1d27] rounded-xl border border-[#2d3148]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d3148]">
              <h2 className="text-sm font-semibold text-white">Fichas de conciliación</h2>
              {tieneFichas && (
                <span className="text-xs text-gray-500">{fichas!.length} generada{fichas!.length > 1 ? "s" : ""}</span>
              )}
            </div>

            {!tieneFichas ? (
              <div className="px-5 py-6 flex flex-col items-center gap-3 text-center">
                <FileText className="w-8 h-8 text-gray-700" />
                <p className="text-sm text-gray-500">Aún no hay fichas generadas</p>
                <Link
                  href={`/generador/${caso.id}/params`}
                  className="text-xs text-[#6b7dff] hover:underline"
                >
                  Generar primera ficha →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-[#2d3148]">
                {fichas!.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-3.5">
                    <FileText className="w-4 h-4 text-[#6b7dff] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/generador/${caso.id}/ficha?ficha_id=${f.id}`}
                        className="text-sm text-white hover:text-[#6b7dff] transition-colors font-medium"
                      >
                        Ficha · {formatDate(f.created_at)}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${estadoBadgeClases(f.estado)}`}
                      >
                        {f.estado.replace("_", " ")}
                      </span>
                      {f.docx_url && (
                        <a
                          href={`/api/exportar-ficha/${f.id}`}
                          download
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#2d3148] hover:bg-[#3a3f5c] text-xs text-gray-300 hover:text-white transition-colors"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          .docx
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Sub-componente ────────────────────────────────────────────────────────────
function DatoFila({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-3.5 h-3.5 text-gray-600 mt-0.5 shrink-0" />
      <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
      <span
        className={`text-sm text-white break-all ${mono ? "font-mono text-xs" : ""}`}
      >
        {value ?? <span className="text-gray-600">—</span>}
      </span>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  parametrosSchema,
  type ParametrosFormData,
  DIRECTRICES,
} from "@/lib/ia/parametros-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, limpiarDespacho } from "@/lib/utils";
import { Loader2, ArrowRight, ArrowLeft, ChevronDown, FileSignature, CheckCircle2, AlertCircle, ExternalLink, Mail, Clock, Handshake, Check, ClipboardList, FileText, Eye, FileDown } from "lucide-react";
import { ConsultaRadicado } from "@/components/fichas/consulta-radicado";
import { VistaPreviaDocumento } from "@/components/fichas/vista-previa-documento";
import { CATALOGO_PRETENSIONES } from "@/lib/data/catalogo-pretensiones";

// ─── Componentes base ──────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex rounded-lg border border-input overflow-hidden w-fit">
      {[true, false].map((opt) => (
        <button
          key={String(opt)}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={cn(
            "px-4 py-1.5 text-sm font-medium transition-colors",
            value === opt
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:bg-muted"
          )}
        >
          {opt ? "Sí" : "No"}
        </button>
      ))}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "w-full appearance-none rounded-md border bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
          error ? "border-destructive" : "border-input",
          !value && "text-muted-foreground"
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function Bloque({ numero, titulo, children, icono }: { numero?: number; titulo: string; children: React.ReactNode; icono?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-primary/5 border-l-4 border-l-primary">
        <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
          {icono ?? numero}
        </span>
        <h3 className="text-[15px] font-bold text-foreground">{titulo}</h3>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

function Campo({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Campo de solo lectura (datos que llegan del CSV/caso importado)
function CampoLectura({ label, valor }: { label: string; valor?: string | null }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">{label}</Label>
      <div className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground/80 min-h-[38px] break-words">
        {valor && valor.trim() ? valor : <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

// ─── Formulario principal ──────────────────────────────────────────────────────

interface FormularioParametricoProps {
  casoId: string;
  casoData: {
    pretension: string | null;
    clase_pretension: string | null;
    jurisdiccion: string | null;
    radicado?: string | null;
    radicado_bizagi?: string | null;
    nombre_demandante?: string | null;
    cedula_demandante?: string | null;
    despacho?: string | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valoresPrellenados?: Record<string, any>;
  sintesisHechosSugerida?: string | null;
  pretensionesSugerida?: string | null;
  cuantiaSugerida?: string | null;
  normasSugerida?: string | null;
  problemaSugerido?: string | null;
  consideracionesSugerida?: string | null;
  pretensionSugerida?: string | null;   // pretensión BUPC detectada (VEJEZ, SOBREVIVIENTES, ...)
  claseSugerida?: string | null;        // clase BUPC detectada
  causanteNombreSugerido?: string | null; // nombre del causante/afiliado detectado (si difiere del demandante)
  causanteCedulaSugerida?: string | null; // cédula del causante/afiliado detectado
}

// Mapea una pretensión BUPC (MAYÚSCULAS) al enum del formulario/ficha; null si no hay equivalencia.
const BUPC_A_ENUM: Record<string, ParametrosFormData["pretension"]> = {
  VEJEZ: "vejez",
  INVALIDEZ: "invalidez",
  SOBREVIVIENTES: "sobrevivientes",
};
// Normaliza (MAYÚSCULAS, sin acentos) para comparar contra el catálogo BUPC.
const normBupc = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

const DEMANDADO_FIJO = "Administradora Colombiana de Pensiones — COLPENSIONES. NIT 900.336.004-7";

// Cuantía por defecto (Sección 3) cuando no se logra extraer del traslado: depende del despacho.
const CUANTIA_DEF_SUP = "Superior a 20 salarios mensuales legales vigentes";
const CUANTIA_DEF_INF = "Inferior a 20 salarios mensuales legales vigentes";
function cuantiaPorDefecto(despacho: string): string {
  const d = (despacho ?? "").toLowerCase();
  if (d.includes("municipal")) return CUANTIA_DEF_INF;   // Municipal o Municipal de pequeñas causas
  if (d.includes("circuito")) return CUANTIA_DEF_SUP;    // Laboral del circuito
  return "";
}
const esCuantiaPorDefecto = (v: string) => {
  const t = (v ?? "").trim();
  return t === CUANTIA_DEF_SUP || t === CUANTIA_DEF_INF;
};

// Sección 12 (Evaluación de riesgo): 4 criterios calificados en 4 niveles.
const CRITERIOS_RIESGO = [
  { key: "defensa",        label: "Riesgo de pérdida por relevancia jurídica de las razones de hecho y derecho del demandante" },
  { key: "probatoria",     label: "Riesgo de pérdida asociado a la contundencia, congruencia y pertinencia de los medios probatorios" },
  { key: "procesales",     label: "Presencia de riesgos procesales y extraprocesales" },
  { key: "jurisprudencia", label: "Riesgo de pérdida asociado al nivel de jurisprudencia" },
] as const;
const NIVELES_RIESGO = [
  { value: "ALTO", label: "ALTO" },
  { value: "MEDIO ALTO", label: "MEDIO ALTO" },
  { value: "MEDIO BAJO", label: "MEDIO BAJO" },
  { value: "BAJO", label: "BAJO" },
];
type CriterioHist = { moda: string; dist: Record<string, number>; n: number };
type RiesgoHist = { fuente: "combo" | "pretension"; n: number; clase: string | null; criterios: Record<string, CriterioHist> };

// Corrige radicados que llegaron en notación científica (ej. 7.6e+22)
function limpiarNum(v: string | null | undefined): string {
  if (!v) return "";
  const s = String(v).trim();
  if (/e\+?\d+/i.test(s)) {
    const n = Number(s);
    if (!Number.isNaN(n)) return n.toLocaleString("fullwide", { useGrouping: false });
  }
  return s;
}

export function FormularioParametrico({ casoId, casoData, valoresPrellenados, sintesisHechosSugerida, pretensionesSugerida, cuantiaSugerida, normasSugerida, problemaSugerido, consideracionesSugerida, pretensionSugerida, claseSugerida, causanteNombreSugerido, causanteCedulaSugerida }: FormularioParametricoProps) {
  const [error, setError] = useState<string | null>(null);
  const [generandoPoder, setGenerandoPoder] = useState(false);
  const [poderGenerado, setPoderGenerado] = useState(false);
  const [trasladoBizagi, setTrasladoBizagi] = useState<boolean | null>(null);
  const [generandoMemorial, setGenerandoMemorial] = useState(false);
  const [memorialGenerado, setMemorialGenerado] = useState(false);
  const [envioUsado, setEnvioUsado] = useState<"portal" | "gmail" | null>(null);
  const [enviandoPendiente, setEnviandoPendiente] = useState(false);
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const [sintesisHechos, setSintesisHechos] = useState("");
  const [pretensionesTexto, setPretensionesTexto] = useState("");
  const [cuantiaTexto, setCuantiaTexto] = useState("");
  const [normasTexto, setNormasTexto] = useState("");
  const [problemaTexto, setProblemaTexto] = useState("");
  const [jurisprudenciaTexto, setJurisprudenciaTexto] = useState("");
  const [consideracionesTexto, setConsideracionesTexto] = useState("");
  const [politicasTexto, setPoliticasTexto] = useState("");
  const [riesgoNiveles, setRiesgoNiveles] = useState<Record<string, string>>({ defensa: "", probatoria: "", procesales: "", jurisprudencia: "" });
  const [riesgoHist, setRiesgoHist] = useState<RiesgoHist | null>(null);

  // Pretensión + clase (catálogo BUPC) — dropdowns de «Información del proceso». Se autocompletan
  // con el análisis de documentos y alimentan la sugerencia de riesgo (sección 12).
  const [pretensionSel, setPretensionSel] = useState<string>(() => {
    const v = normBupc(casoData.pretension);
    return CATALOGO_PRETENSIONES.some((c) => c.pretension === v) ? v : "";
  });
  const [claseSel, setClaseSel] = useState<string>(() => {
    const p = normBupc(casoData.pretension);
    const cl = normBupc(casoData.clase_pretension);
    const entrada = CATALOGO_PRETENSIONES.find((c) => c.pretension === p);
    return entrada?.clases.some((c) => c.clase === cl) ? cl : "";
  });
  const clasesDePretension = CATALOGO_PRETENSIONES.find((c) => c.pretension === pretensionSel)?.clases ?? [];
  const prevPrellenados = useRef<Partial<ParametrosFormData> | undefined>(undefined);

  // Paso "Revisar y descargar"
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generandoPreview, setGenerandoPreview] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState(() => {
    const hoy = new Date();
    const f = `${hoy.getFullYear()}${String(hoy.getMonth() + 1).padStart(2, "0")}${String(hoy.getDate()).padStart(2, "0")}`;
    const ced = (casoData.cedula_demandante ?? "").replace(/\D/g, "");
    return `${f}_FichaConciliacion${ced ? `_CC_${ced}` : ""}`;
  });

  // Encabezado del proceso (editable) — arranca con los datos del CSV/caso
  const [encabezado, setEncabezado] = useState({
    radicado_bizagi:   casoData.radicado_bizagi ?? "",
    radicado:          limpiarNum(casoData.radicado),
    nombre_demandante: casoData.nombre_demandante ?? "",
    cedula_demandante: casoData.cedula_demandante ?? "",
    despacho:          limpiarDespacho(casoData.despacho) ?? "",
  });
  const setEnc = (k: keyof typeof encabezado, v: string) =>
    setEncabezado((prev) => ({ ...prev, [k]: v }));

  // Asistente por pasos (título + subtítulo)
  const PASOS = [
    { t: "Información del proceso",   s: "Datos generales" },
    { t: "Contenido de la demanda",  s: "Hechos y pretensiones" },
    { t: "Análisis jurídico",        s: "Tesis y estrategia" },
    { t: "Conceptos y cierre",       s: "Conclusiones" },
    { t: "Revisar y descargar",      s: "Vista previa" },
  ];
  const [paso, setPaso] = useState(1);
  const totalPasos = PASOS.length;

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ParametrosFormData>({
    resolver: zodResolver(parametrosSchema),
    defaultValues: {
      conciliable: true,
      directriz_conciliacion: "",
      pretension: (casoData.pretension as ParametrosFormData["pretension"]) ?? "vejez",
      clase_pretension: casoData.clase_pretension ?? "",
      resolucion_prestacion: "",
      semanas_cotizadas: null,
      tasa_aplicada: null,
      tasa_solicitada: null,
      cuantia_tipo: "indeterminada",
      cuantia_valor: null,
      pretende_intereses: false,
      pretende_indexacion: false,
      jurisdiccion: (casoData.jurisdiccion as ParametrosFormData["jurisdiccion"]) ?? "ordinaria",
      tipo_conciliacion: "parametrica",
      hay_fallo: false,
      sintesis_fallo: "",
      fecha_diligencia: null,
      caducidad: "NO",
      expediente_pensional_aplica: null,
      causante_afiliado: null,
      reconsideracion: null,
      juez: null,
    },
  });

  const conciliable      = watch("conciliable");
  // Causante/afiliado: el campo se llena SIEMPRE con el afiliado (coincida o no con el
  // demandante). Se resalta en naranja SOLO cuando difiere del demandante del CSV.
  const causanteAfiliado = watch("causante_afiliado");
  const causanteDifiere  = (() => {
    const val = (causanteAfiliado ?? "").trim();
    if (!val) return false;
    const demCedula = (encabezado.cedula_demandante ?? "").replace(/\D/g, "");
    const demNombre = (encabezado.nombre_demandante ?? "").trim().toLowerCase();
    // Separa la cédula (tras «C.C.») y el nombre del contenido del campo.
    const m = val.match(/c\.?\s*c\.?\s*[:\-]?\s*([\d.\s]+)/i);
    const valCedula = m ? m[1].replace(/\D/g, "") : "";
    const valNombre = val.replace(/,?\s*c\.?\s*c\.?.*/i, "").trim().toLowerCase();
    if (valCedula && demCedula) return valCedula !== demCedula;   // compara por cédula si es posible
    if (valNombre && demNombre) return valNombre !== demNombre;   // respaldo por nombre
    return false;
  })();

  async function handleGenerarPoder() {
    setGenerandoPoder(true);
    try {
      const res = await fetch(`/api/generar-poder-sustitucion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caso_id: casoId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al generar el poder");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PODER_SUSTITUCION_${casoId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setPoderGenerado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el poder");
    } finally {
      setGenerandoPoder(false);
    }
  }

  // Aplicar valores pre-llenados desde PDFs cuando cambian
  useEffect(() => {
    if (!valoresPrellenados || valoresPrellenados === prevPrellenados.current) return;
    prevPrellenados.current = valoresPrellenados;
    (Object.entries(valoresPrellenados) as [keyof ParametrosFormData, unknown][]).forEach(
      ([key, val]) => {
        if (val === null || val === undefined) return;
        setValue(key, val as never, { shouldDirty: true });
      }
    );
  }, [valoresPrellenados, setValue]);

  // Traer la síntesis de hechos extraída del traslado al cuadro de texto (Sección 1),
  // mientras esté vacío (no pisar lo que el abogado escriba).
  useEffect(() => {
    if (sintesisHechosSugerida && !sintesisHechos.trim()) {
      setSintesisHechos(sintesisHechosSugerida);
    }
  }, [sintesisHechosSugerida, sintesisHechos]);

  // Traer las pretensiones extraídas del traslado al cuadro de texto (Sección 2).
  useEffect(() => {
    if (pretensionesSugerida && !pretensionesTexto.trim()) {
      setPretensionesTexto(pretensionesSugerida);
    }
  }, [pretensionesSugerida, pretensionesTexto]);

  // Sección 3 (Cuantía): usar el valor extraído del traslado; si no se logró extraer,
  // insertar el valor por defecto según el despacho (Circuito → superior; Municipal → inferior).
  // Solo se aplica si el campo está vacío o si aún tiene un valor por defecto (no editado a mano).
  useEffect(() => {
    const efectiva = cuantiaSugerida?.trim() ? cuantiaSugerida : cuantiaPorDefecto(encabezado.despacho);
    if (!efectiva) return;
    setCuantiaTexto((prev) => (!prev.trim() || esCuantiaPorDefecto(prev)) ? efectiva : prev);
  }, [cuantiaSugerida, encabezado.despacho]);

  // Traer las normas extraídas del traslado al cuadro de texto (Sección 4).
  useEffect(() => {
    if (normasSugerida && !normasTexto.trim()) {
      setNormasTexto(normasSugerida);
    }
  }, [normasSugerida, normasTexto]);

  // Traer el planteamiento del problema jurídico generado al cuadro de texto (Sección 7).
  useEffect(() => {
    if (problemaSugerido && !problemaTexto.trim()) {
      setProblemaTexto(problemaSugerido);
    }
  }, [problemaSugerido, problemaTexto]);

  // Traer las consideraciones generadas (análisis de las resoluciones) al cuadro de texto (Sección Consideraciones).
  useEffect(() => {
    if (consideracionesSugerida && !consideracionesTexto.trim()) {
      setConsideracionesTexto(consideracionesSugerida);
    }
  }, [consideracionesSugerida, consideracionesTexto]);

  // Autocompletar los dropdowns de pretensión + clase con la clasificación detectada por el análisis
  // de documentos (solo si el campo sigue vacío; no pisa la selección manual del abogado).
  useEffect(() => {
    const p = normBupc(pretensionSugerida);
    if (p && CATALOGO_PRETENSIONES.some((c) => c.pretension === p)) {
      setPretensionSel((prev) => prev || p);
      const enumVal = BUPC_A_ENUM[p];
      if (enumVal) setValue("pretension", enumVal, { shouldDirty: true });
    }
  }, [pretensionSugerida, setValue]);

  useEffect(() => {
    const p = normBupc(pretensionSugerida);
    const cl = normBupc(claseSugerida);
    const entrada = CATALOGO_PRETENSIONES.find((c) => c.pretension === p);
    if (cl && entrada?.clases.some((c) => c.clase === cl)) {
      setClaseSel((prev) => prev || cl);
    }
  }, [pretensionSugerida, claseSugerida]);

  // Causante/afiliado: se autocompleta SIEMPRE con el afiliado detectado por el análisis, coincida
  // o no con el demandante. El resalte naranja (más abajo) se activa solo cuando difiere.
  // No pisa lo que el abogado ya haya escrito.
  useEffect(() => {
    const nombre = (causanteNombreSugerido ?? "").trim();
    const cedula = (causanteCedulaSugerida ?? "").replace(/\D/g, "");
    if (!nombre && !cedula) return;
    if ((getValues("causante_afiliado") ?? "").trim()) return; // no sobreescribir

    // Cédula sin separadores de miles (dígitos puros); los puntos solo en la sigla «C.C.».
    const texto = `${nombre}${cedula ? `, C.C. ${cedula}` : ""}`.trim();
    if (texto) setValue("causante_afiliado", texto, { shouldDirty: true });
  }, [causanteNombreSugerido, causanteCedulaSugerida, getValues, setValue]);

  // Sección 12 (Evaluación de riesgo): traer la calificación histórica (moda por criterio) según
  // la pretensión + clase SELECCIONADAS en el paso 1, y prellenar los selectores vacíos con la sugerencia.
  useEffect(() => {
    // Si aún no se ha determinado la pretensión, se usa "VEJEZ" (la más frecuente) para mostrar una
    // sugerencia base; en cuanto el análisis o el abogado fija la pretensión, se recalcula.
    const p = pretensionSel || "VEJEZ";
    const q = new URLSearchParams({ pretension: p, clase: claseSel });
    fetch(`/api/riesgo-historico?${q.toString()}`)
      .then((r) => r.json())
      .then((d: RiesgoHist & { criterios: Record<string, CriterioHist> | null }) => {
        if (!d?.criterios) { setRiesgoHist(null); return; }
        setRiesgoHist(d as RiesgoHist);
        setRiesgoNiveles((prev) => {
          const next = { ...prev };
          for (const c of CRITERIOS_RIESGO) {
            if (!next[c.key] && d.criterios?.[c.key]?.moda) next[c.key] = d.criterios[c.key].moda;
          }
          return next;
        });
      })
      .catch(() => {});
  }, [pretensionSel, claseSel]);

  // Si el usuario vuelve atrás a editar, se invalida la ficha ya generada y su vista previa,
  // para que al volver a "Revisar y descargar" se regenere con los cambios.
  useEffect(() => {
    if (paso < totalPasos) {
      setFichaId(null);
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    }
  }, [paso, totalPasos]);

  async function handleGenerarMemorial() {
    setGenerandoMemorial(true);
    try {
      const res = await fetch("/api/generar-memorial-expediente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caso_id: casoId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Error al generar el memorial");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MEMORIAL_EXPEDIENTE_${casoId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setMemorialGenerado(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el memorial");
    } finally {
      setGenerandoMemorial(false);
    }
  }

  async function handleEnviarPendiente() {
    setEnviandoPendiente(true);
    try {
      const acciones: { tipo: string; descripcion: string }[] = [];
      if (memorialGenerado) acciones.push({ tipo: "memorial_generado", descripcion: "Memorial de solicitud de acceso al expediente generado y descargado." });
      if (envioUsado === "portal") acciones.push({ tipo: "enviado_portal", descripcion: "Documentos cargados en el Portal Rama Judicial (SIUGJ)." });
      if (envioUsado === "gmail") acciones.push({ tipo: "enviado_correo", descripcion: "Correo redactado en Gmail para envío al despacho judicial." });

      const res = await fetch("/api/pendientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caso_id: casoId,
          motivo: "sin_traslado_demanda",
          descripcion: "El proceso no cuenta con traslado y anexos de la demanda en Bizagi.",
          acciones,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar en pendientes");
      const { pendiente_id } = await res.json();
      setPendienteId(pendiente_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setEnviandoPendiente(false);
    }
  }

  // Genera la ficha (si aún no existe en esta sesión) y devuelve su id.
  async function asegurarFicha(data: ParametrosFormData): Promise<string> {
    if (fichaId) return fichaId;
    const res = await fetch("/api/generar-ficha", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caso_id: casoId,
        params: data,
        caso_override: {
          radicado_bizagi:   encabezado.radicado_bizagi.trim() || null,
          radicado:          encabezado.radicado.trim() || null,
          nombre_demandante: encabezado.nombre_demandante.trim() || null,
          cedula_demandante: encabezado.cedula_demandante.trim() || null,
          despacho:          encabezado.despacho.trim() || null,
        },
        secciones_manual: {
          sec_1_hechos: sintesisHechos.trim() || null,
          sec_2_pretensiones: pretensionesTexto.trim() || null,
          sec_3_cuantia: cuantiaTexto.trim() || null,
          sec_4_normas: normasTexto.trim() || null,
          sec_8_problema: problemaTexto.trim() || null,
          sec_11_jurisprudencia: jurisprudenciaTexto.trim() || null,
          sec_16_consideraciones: consideracionesTexto.trim() || null,
          sec_15_politicas: politicasTexto.trim() || null,
          sec_17_riesgo: (() => {
            const lineas = CRITERIOS_RIESGO
              .filter((c) => riesgoNiveles[c.key])
              .map((c) => `• ${c.label}: ${riesgoNiveles[c.key]}`);
            return lineas.length ? lineas.join("\n") : null;
          })(),
          // Sección 13 (Recomendación): si el asunto NO es conciliable, recomendación fija.
          sec_18_recomendacion: data.conciliable === false
            ? "Una vez estudiado el caso, recomiendo NO CONCILIAR; de acuerdo con las consideraciones expuestas."
            : null,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Error al generar la ficha");
    }
    const { ficha_id } = await res.json();
    setFichaId(ficha_id);
    return ficha_id;
  }

  // Si la validación falla (campos obligatorios de pasos anteriores), avisa y vuelve al paso 1.
  function onValidacionFallida() {
    setError("Faltan campos obligatorios en pasos anteriores (por ejemplo, la directriz de conciliación en el paso 1). Complétalos y vuelve a intentar.");
    setPaso(1);
  }

  const handleVistaPrevia = handleSubmit(async (data) => {
    setGenerandoPreview(true);
    setError(null);
    try {
      const id = await asegurarFicha(data);
      const res = await fetch(`/api/exportar-ficha-pdf/${id}`);
      if (!res.ok) throw new Error("No se pudo generar la vista previa del PDF.");
      const blob = await res.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar la vista previa");
    } finally {
      setGenerandoPreview(false);
    }
  }, onValidacionFallida);

  const handleDescargarPdf = handleSubmit(async (data) => {
    setDescargandoPdf(true);
    setError(null);
    try {
      const id = await asegurarFicha(data);
      const res = await fetch(`/api/exportar-ficha-pdf/${id}`);
      if (!res.ok) throw new Error("No se pudo descargar el PDF.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nombreArchivo.trim() || "FICHA_CONCILIACION"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al descargar el PDF");
    } finally {
      setDescargandoPdf(false);
    }
  }, onValidacionFallida);

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-5">

      {/* ── Asistente por pasos ── */}
      <div className="flex items-center border-b border-border pb-5">
        {PASOS.map((p, i) => {
          const n = i + 1;
          const activo = n === paso;
          const hecho = n < paso;
          return (
            <div key={n} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => setPaso(n)}
                className="flex items-center gap-2.5 group shrink-0 text-left"
              >
                <span className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
                  activo
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/10"
                    : hecho
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground border border-border"
                )}>
                  {hecho ? <Check className="w-3.5 h-3.5" /> : n}
                </span>
                <span className="hidden md:flex flex-col leading-tight">
                  <span className={cn(
                    "text-sm transition-colors",
                    activo ? "text-foreground font-semibold" : hecho ? "text-foreground/70" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {p.t}
                  </span>
                  <span className={cn(
                    "text-[11px] transition-colors",
                    activo ? "text-muted-foreground" : "text-muted-foreground/60"
                  )}>
                    {p.s}
                  </span>
                </span>
              </button>
              {n < totalPasos && (
                <div className={cn("flex-1 h-px mx-3 min-w-[16px]", hecho ? "bg-primary/40" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Paso 1: Información del proceso + Documentos previos + Conciliabilidad ── */}
      {paso === 1 && (<>

      {/* ── Información del proceso (encabezado v3) ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
          <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <ClipboardList className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Información del proceso</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Datos de la cabecera de la ficha</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Fecha de la diligencia">
              <Controller name="fecha_diligencia" control={control}
                render={({ field }) => (
                  <Input type="date" value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} />
                )} />
            </Campo>
            <Campo label="Radicación de demanda en Bizagi">
              <Input value={encabezado.radicado_bizagi} onChange={(e) => setEnc("radicado_bizagi", e.target.value)} placeholder="Ej: 2025_1398203" />
            </Campo>
            <Campo label="Radicación del proceso (23 dígitos)">
              <div className="flex items-center gap-2">
                <Input className="flex-1" value={encabezado.radicado} onChange={(e) => setEnc("radicado", e.target.value)} placeholder="Número de radicación completo" />
                <ConsultaRadicado radicado={encabezado.radicado} />
              </div>
            </Campo>
            <Campo label="Nombre del demandante">
              <Input value={encabezado.nombre_demandante} onChange={(e) => setEnc("nombre_demandante", e.target.value)} placeholder="Ej: Wilson Lugo" />
            </Campo>
            <Campo label="Cédula del demandante">
              <Input value={encabezado.cedula_demandante} onChange={(e) => setEnc("cedula_demandante", e.target.value)} placeholder="Ej: 16628522" />
            </Campo>
            <Campo label="Nombre e identificación causante y/o afiliado">
              <Controller name="causante_afiliado" control={control}
                render={({ field }) => (
                  <Input
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    placeholder="Nombre y cédula del afiliado (se completa al analizar los documentos)"
                    className={cn(
                      causanteDifiere &&
                        "border-orange-400 bg-orange-50 text-orange-900 placeholder:text-orange-400 focus-visible:ring-orange-400 dark:border-orange-600 dark:bg-orange-950/30 dark:text-orange-200"
                    )}
                  />
                )} />
              {causanteDifiere && (
                <p className="text-[11px] text-orange-600 dark:text-orange-400 flex items-start gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                  El causante/afiliado difiere del demandante. Verifica el nombre y la cédula.
                </p>
              )}
            </Campo>
            <CampoLectura label="Nombre e identificación demandado" valor={DEMANDADO_FIJO} />
            <Campo label="Autoridad que efectúa la citación">
              <Input value={encabezado.despacho} onChange={(e) => setEnc("despacho", e.target.value)} placeholder="Juzgado / autoridad que cita" />
            </Campo>
            <Campo label="Caducidad">
              <Controller name="caducidad" control={control}
                render={({ field }) => (
                  <Select value={field.value ?? "NO"} onChange={field.onChange}
                    options={[
                      { value: "NO",        label: "NO" },
                      { value: "SI",        label: "SÍ — Opera la caducidad" },
                      { value: "NO APLICA", label: "NO APLICA — Proceso ordinario" },
                    ]} />
                )} />
            </Campo>
            <Campo label="Reconsideración">
              <Controller name="reconsideracion" control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onChange={field.onChange} placeholder="Selecciona..."
                    options={[{ value: "SI", label: "SÍ" }, { value: "NO", label: "NO" }]} />
                )} />
            </Campo>
            <Campo label="Pretensión">
              <Select
                value={pretensionSel}
                onChange={(v) => {
                  setPretensionSel(v);
                  setClaseSel("");   // la clase depende de la pretensión
                  const enumVal = BUPC_A_ENUM[v];
                  if (enumVal) setValue("pretension", enumVal, { shouldDirty: true });
                }}
                placeholder="Selecciona la pretensión…"
                options={CATALOGO_PRETENSIONES.map((c) => ({ value: c.pretension, label: c.pretension }))}
              />
            </Campo>
            <Campo label="Clase de pretensión">
              <Select
                value={claseSel}
                onChange={(v) => { setClaseSel(v); setValue("clase_pretension", v, { shouldDirty: true }); }}
                placeholder={pretensionSel ? "Selecciona la clase…" : "Selecciona primero la pretensión"}
                options={clasesDePretension.map((c) => ({ value: c.clase, label: c.clase }))}
              />
            </Campo>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-start gap-1">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
            {pretensionSugerida
              ? "Pretensión y clase determinadas automáticamente del análisis de documentos. Ajústalas si es necesario; alimentan la sugerencia de riesgo (paso 4)."
              : "Se determinan automáticamente al analizar los documentos en el panel de la derecha; también puedes seleccionarlas a mano. Alimentan la sugerencia de riesgo (paso 4)."}
          </p>
        </div>
      </div>

      {/* ── Bloque 0: Documentos previos ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
        {/* Header del bloque — estilo diferenciado del bloque de datos */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-primary/5 border-l-4 border-l-primary">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <FileSignature className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-foreground leading-tight">Documentos previos</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Poder de sustitución y traslado de la demanda</p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Generar Poder de Sustitución */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            {poderGenerado ? (
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="font-medium">Poder de Sustitución generado correctamente</span>
                <button
                  type="button"
                  onClick={() => setPoderGenerado(false)}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Regenerar
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-foreground">Poder de Sustitución</p>
                  <p className="text-[11px] text-muted-foreground">Genera el documento Word con los datos del caso</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <VistaPreviaDocumento
                    endpoint="/api/generar-poder-sustitucion"
                    casoId={casoId}
                    titulo="Poder de Sustitución"
                    filename={`PODER_SUSTITUCION_${casoId}.pdf`}
                  />
                  <button
                    type="button"
                    disabled={generandoPoder}
                    onClick={handleGenerarPoder}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-60"
                  >
                    {generandoPoder
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
                      : <><FileSignature className="w-3.5 h-3.5" /> Generar Poder</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Traslado y anexos en Bizagi ── */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Traslado y anexos de la demanda
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ¿Se cuenta con traslado y anexos de la demanda en Bizagi?
                </p>
              </div>
              <div className="flex rounded-lg border border-input overflow-hidden w-fit shrink-0">
                {([true, false] as const).map((opt) => (
                  <button
                    key={String(opt)}
                    type="button"
                    onClick={() => {
                      setTrasladoBizagi(opt);
                      if (opt) setMemorialGenerado(false);
                    }}
                    className={cn(
                      "px-4 py-1.5 text-sm font-medium transition-colors",
                      trasladoBizagi === opt
                        ? opt
                          ? "bg-green-600 text-white"
                          : "bg-[#6b93de] text-white"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {opt ? "Sí" : "No"}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel del memorial — solo visible cuando respuesta = No */}
            {trasladoBizagi === false && (
              <>
                {/* Memorial */}
                <div className="rounded-lg border border-[#c5d8f4] bg-[#eef3fc] dark:bg-blue-950/20 dark:border-blue-800 px-4 py-3 space-y-3">
                  {/* Fila: generar memorial */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        Memorial — Solicitud de acceso al expediente
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Dirigido al Juzgado o despacho judicial del caso
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {memorialGenerado && (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      )}
                      <VistaPreviaDocumento
                        endpoint="/api/generar-memorial-expediente"
                        casoId={casoId}
                        titulo="Memorial — Solicitud de acceso al expediente"
                        filename={`MEMORIAL_EXPEDIENTE_${casoId}.pdf`}
                      />
                      <button
                        type="button"
                        disabled={generandoMemorial}
                        onClick={handleGenerarMemorial}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#6b93de] text-white hover:bg-[#5a82d0] transition-colors disabled:opacity-60"
                      >
                        {generandoMemorial
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
                          : memorialGenerado
                            ? <><AlertCircle className="w-3.5 h-3.5" /> Regenerar</>
                            : <><AlertCircle className="w-3.5 h-3.5" /> Generar Memorial</>
                        }
                      </button>
                    </div>
                  </div>

                  {/* Botones de envío — se muestran tras generar el memorial */}
                  {memorialGenerado && (
                    <div className="border-t border-[#c5d8f4] dark:border-blue-800 pt-3 space-y-2">
                      {envioUsado ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            <span className="text-xs">
                              {envioUsado === "portal"
                                ? "Portal Rama Judicial abierto"
                                : "Gmail abierto para redactar"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEnvioUsado(null)}
                            className="text-[11px] text-muted-foreground hover:text-foreground underline transition-colors"
                          >
                            Usar otro medio
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-[11px] font-semibold text-[#4a6fc0] dark:text-blue-400 uppercase tracking-wide">
                            Enviar documentos
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <a
                              href="https://siugj.ramajudicial.gov.co/principalPortal/index.php"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setEnvioUsado("portal")}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary text-primary bg-white dark:bg-card hover:bg-primary hover:text-primary-foreground transition-colors text-xs font-semibold flex-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              Portal Rama Judicial
                            </a>
                            <a
                              href={`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(
                                `Solicitud acceso expediente — Rad. ${casoId}`
                              )}&body=${encodeURIComponent(
                                `Cordial saludo,\n\nAdjunto memorial de solicitud de acceso al expediente y poder de sustitución correspondientes al proceso.\n\nAtentamente,\nCollegia Abogados`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setEnvioUsado("gmail")}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground bg-white dark:bg-card hover:bg-muted transition-colors text-xs font-semibold flex-1"
                            >
                              <Mail className="w-3.5 h-3.5 shrink-0" />
                              Enviar por Gmail
                            </a>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Adjunta el memorial y el poder descargados antes de enviar.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Bandeja de pendientes — independiente del memorial */}
                <div className="rounded-lg border border-border bg-card px-4 py-3">
                  {pendienteId ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <span>Caso enviado a la bandeja de pendientes</span>
                      </div>
                      <a
                        href="/pendientes"
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Ver pendientes →
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-foreground">Bandeja de pendientes</p>
                        <p className="text-[11px] text-muted-foreground">Registrar este caso para seguimiento posterior</p>
                      </div>
                      <button
                        type="button"
                        disabled={enviandoPendiente}
                        onClick={handleEnviarPendiente}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input text-foreground text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-60 shrink-0"
                      >
                        {enviandoPendiente
                          ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                          : <><Clock className="w-3.5 h-3.5" /> Enviar a pendientes</>
                        }
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Conciliabilidad (dentro del paso 1) ── */}
      <Bloque icono={<Handshake className="w-4 h-4" />} titulo="Conciliación">
        <Campo label="¿El asunto es conciliable?" required>
          <Controller
            name="conciliable"
            control={control}
            render={({ field }) => (
              <Toggle value={field.value} onChange={field.onChange} />
            )}
          />
        </Campo>

        {conciliable && (
          <Campo
            label="Directriz de conciliación"
            required
            error={errors.directriz_conciliacion?.message}
          >
            <Controller
              name="directriz_conciliacion"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Selecciona la directriz..."
                  options={DIRECTRICES.map((d) => ({ value: d, label: d }))}
                  error={errors.directriz_conciliacion?.message}
                />
              )}
            />
          </Campo>
        )}
      </Bloque>
      </>)}

      {/* ── Paso 2: Pretensión y cuantía ── */}
      {paso === 2 && (<>

      {/* Síntesis de los hechos (Sección 1) — traída del traslado por el API */}
      <Bloque icono={<FileText className="w-4 h-4" />} titulo="Síntesis de los hechos">
        <Campo label="Resumen de los hechos (Sección 1 del documento)">
          <textarea
            value={sintesisHechos}
            onChange={(e) => setSintesisHechos(e.target.value)}
            rows={8}
            placeholder="Se traerá automáticamente desde el documento «Traslado de la demanda» (título HECHOS) al analizar los PDFs en el paso 1. También puedes escribirlo o editarlo aquí."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[140px]"
          />
        </Campo>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {sintesisHechosSugerida
            ? "Resumen sugerido a partir del traslado. Revísalo antes de continuar; podrás editarlo."
            : "Sube el «Traslado de la demanda» en el paso 1 y pulsa «Analizar con IA» para traer aquí el resumen de los hechos."}
        </p>
      </Bloque>

      {/* Pretensiones (Sección 2) — traídas del título PRETENSIONES del traslado */}
      <Bloque icono={<FileText className="w-4 h-4" />} titulo="Pretensiones">
        <Campo label="Resumen de las pretensiones (Sección 2 del documento)">
          <textarea
            value={pretensionesTexto}
            onChange={(e) => setPretensionesTexto(e.target.value)}
            rows={8}
            placeholder="Se traerá automáticamente desde el documento «Traslado de la demanda» (título PRETENSIONES) al analizar los PDFs en el paso 1. También puedes escribirlo o editarlo aquí."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[140px]"
          />
        </Campo>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {pretensionesSugerida
            ? "Pretensiones sugeridas a partir del traslado. Revísalas antes de continuar; podrás editarlas."
            : "Sube el «Traslado de la demanda» en el paso 1 y pulsa «Analizar con IA» para traer aquí las pretensiones."}
        </p>
      </Bloque>


      {/* Cuantía (Sección 3) — traída del título CUANTÍA del traslado */}
      <Bloque icono={<FileText className="w-4 h-4" />} titulo="Cuantía">
        <Campo label="Cuantía (Sección 3 del documento)">
          <textarea
            value={cuantiaTexto}
            onChange={(e) => setCuantiaTexto(e.target.value)}
            rows={3}
            placeholder="La cuantía fue estimada por la parte actora, en ___. (Se trae del título «CUANTÍA» / «COMPETENCIA Y CUANTÍA» del traslado; puede ser en moneda o en SMLMV.)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[80px]"
          />
        </Campo>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {cuantiaSugerida
            ? "Cuantía sugerida a partir del traslado. Revísala antes de continuar; podrás editarla."
            : "Sube el «Traslado de la demanda» en el paso 1 y pulsa «Analizar con IA» para traer aquí la cuantía."}
        </p>
      </Bloque>

      {/* Presuntas normas violadas (Sección 4) — del título FUNDAMENTOS Y RAZONES DE DERECHO / NORMAS VIOLADAS */}
      <Bloque icono={<FileText className="w-4 h-4" />} titulo="Presuntas normas violadas">
        <Campo label="Presuntas normas violadas (Sección 4 del documento)">
          <textarea
            value={normasTexto}
            onChange={(e) => setNormasTexto(e.target.value)}
            rows={8}
            placeholder="Se relacionan las leyes, decretos, artículos y normatividad citada en el título «FUNDAMENTOS Y RAZONES DE DERECHO» / «NORMAS VIOLADAS» / «CONCEPTO DE VIOLACIÓN» del traslado (una por línea)."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[140px]"
          />
        </Campo>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          {normasSugerida
            ? "Normas sugeridas a partir del traslado. Revísalas antes de continuar; podrás editarlas."
            : "Sube el «Traslado de la demanda» en el paso 1 y pulsa «Analizar con IA» para traer aquí las normas."}
        </p>
      </Bloque>

      </>)}

      {/* ── Paso 3: Análisis jurídico ── */}
      {paso === 3 && (<>
      <Bloque icono={<FileText className="w-4 h-4" />} titulo="Problema jurídico">
        <Campo label="Problema jurídico (Sección 7 del documento)">
          <textarea
            value={problemaTexto}
            onChange={(e) => setProblemaTexto(e.target.value)}
            rows={5}
            placeholder="Plantea el problema jurídico central del caso. Si lo dejas vacío, se generará automáticamente al crear la ficha."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[100px]"
          />
        </Campo>
      </Bloque>

      <Bloque icono={<FileText className="w-4 h-4" />} titulo="Jurisprudencia">
        <Campo label="Jurisprudencia (Sección 9 del documento)">
          <textarea
            value={jurisprudenciaTexto}
            onChange={(e) => setJurisprudenciaTexto(e.target.value)}
            rows={7}
            placeholder="Cita la jurisprudencia aplicable (corporación, número de sentencia/radicado y ratio decidendi). Si lo dejas vacío, se generará automáticamente."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[130px]"
          />
        </Campo>
      </Bloque>

      <Bloque icono={<FileText className="w-4 h-4" />} titulo="Consideraciones">
        <Campo label="Consideraciones (Sección 11 del documento)">
          <textarea
            value={consideracionesTexto}
            onChange={(e) => setConsideracionesTexto(e.target.value)}
            rows={8}
            placeholder="Consideraciones jurídicas de fondo sobre la procedencia de la conciliación. Si lo dejas vacío, se generará automáticamente."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[140px]"
          />
        </Campo>
      </Bloque>
      </>)}

      {/* ── Paso 4: Conceptos y cierre ── */}
      {paso === 4 && (<>
      <Bloque icono={<FileText className="w-4 h-4" />} titulo="Políticas / llamamientos">
        <Campo label="Políticas / llamamientos (Sección 10 del documento)">
          <textarea
            value={politicasTexto}
            onChange={(e) => setPoliticasTexto(e.target.value)}
            rows={6}
            placeholder="Políticas institucionales y llamamientos aplicables. Si lo dejas vacío, se usará el texto por defecto."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[120px]"
          />
        </Campo>
      </Bloque>

      <Bloque icono={<FileText className="w-4 h-4" />} titulo="Evaluación de riesgo">
        <p className="text-[11px] text-muted-foreground -mt-1">
          Califica la probabilidad de pérdida del proceso en cada criterio. Los selectores traen una <strong>sugerencia histórica</strong> (moda de la base de casos) que puedes cambiar según tu criterio.
        </p>
        {riesgoHist && (
          <p className="text-[11px] text-primary/70">
            Sugerencia basada en <strong>{riesgoHist.n.toLocaleString("es-CO")}</strong> casos {riesgoHist.fuente === "combo" && riesgoHist.clase ? `de ${riesgoHist.clase}` : `(por pretensión)`}.
          </p>
        )}
        <div className="space-y-4">
          {CRITERIOS_RIESGO.map((c) => {
            const h = riesgoHist?.criterios?.[c.key];
            return (
              <Campo key={c.key} label={c.label}>
                <Select
                  value={riesgoNiveles[c.key] ?? ""}
                  onChange={(v) => setRiesgoNiveles((prev) => ({ ...prev, [c.key]: v }))}
                  placeholder="Selecciona el nivel…"
                  options={NIVELES_RIESGO}
                />
                {h && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Histórico: {Object.entries(h.dist).map(([niv, pct]) => `${niv} ${pct}%`).join(" · ")}
                    {h.moda ? <> — sugerido: <strong>{h.moda}</strong></> : null}
                  </p>
                )}
              </Campo>
            );
          })}
        </div>
      </Bloque>
      </>)}

      {/* ── Paso 5: Revisar y descargar ── */}
      {paso === 5 && (
      <div className="rounded-xl border border-border bg-card overflow-hidden card-shadow">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[15px] font-bold text-foreground">Revisar y descargar</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Plantilla: Ficha de Conciliación Judicial (GDJ-GPO-FMT-005 v3).
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Nombre del archivo */}
          <div className="rounded-lg border border-input px-4 py-3">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">Archivo</label>
            <input
              value={nombreArchivo}
              onChange={(e) => setNombreArchivo(e.target.value)}
              className="w-full mt-1 bg-transparent text-sm font-mono text-foreground focus:outline-none"
              placeholder="Nombre del archivo"
            />
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleVistaPrevia}
              disabled={generandoPreview || descargandoPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-60"
            >
              {generandoPreview
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</>
                : <><Eye className="w-4 h-4" /> Generar vista previa</>}
            </button>
            <button
              type="button"
              onClick={handleDescargarPdf}
              disabled={descargandoPdf || generandoPreview}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {descargandoPdf
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Descargando…</>
                : <><FileDown className="w-4 h-4" /> Descargar PDF</>}
            </button>
          </div>

          {/* Vista previa */}
          {previewUrl ? (
            <div className="rounded-lg border border-border overflow-hidden bg-muted/20" style={{ height: "70vh" }}>
              <iframe src={previewUrl} title="Vista previa de la ficha" className="w-full h-full border-0" />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
              Genera la vista previa para revisar el documento antes de descargar.
            </div>
          )}
        </div>
      </div>
      )}

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Espaciador para que el contenido no quede tapado por la barra fija */}
      <div className="h-20" />

      {/* ── Barra de acción inferior fija ── */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[220px] z-30 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-foreground">{paso}</span>
            <span>Paso {paso} de {totalPasos} · <span className="text-foreground font-medium">{PASOS[paso - 1].t}</span></span>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <Button
              type="button"
              variant="outline"
              disabled={paso === 1}
              onClick={() => setPaso((p) => Math.max(1, p - 1))}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Anterior
            </Button>
            {paso < totalPasos && (
              <Button
                type="button"
                onClick={() => setPaso((p) => Math.min(totalPasos, p + 1))}
              >
                {paso === totalPasos - 1 ? "Revisar y descargar" : "Siguiente"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

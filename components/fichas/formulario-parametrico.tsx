"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  parametrosSchema,
  type ParametrosFormData,
  CLASES_POR_PRETENSION,
  DIRECTRICES,
} from "@/lib/ia/parametros-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2, ArrowRight, ChevronDown, FileSignature, CheckCircle2, AlertCircle, ExternalLink, Mail, Clock } from "lucide-react";

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
              ? "bg-primary text-white"
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

function Bloque({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
        <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
          {numero}
        </span>
        <h3 className="text-sm font-semibold">{titulo}</h3>
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
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
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
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valoresPrellenados?: Record<string, any>;
}

export function FormularioParametrico({ casoId, casoData, valoresPrellenados }: FormularioParametricoProps) {
  const router = useRouter();
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generandoPoder, setGenerandoPoder] = useState(false);
  const [poderGenerado, setPoderGenerado] = useState(false);
  const [trasladoBizagi, setTrasladoBizagi] = useState<boolean | null>(null);
  const [generandoMemorial, setGenerandoMemorial] = useState(false);
  const [memorialGenerado, setMemorialGenerado] = useState(false);
  const [envioUsado, setEnvioUsado] = useState<"portal" | "gmail" | null>(null);
  const [enviandoPendiente, setEnviandoPendiente] = useState(false);
  const [pendienteId, setPendienteId] = useState<string | null>(null);
  const prevPrellenados = useRef<Partial<ParametrosFormData> | undefined>(undefined);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
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
      caducidad: null,
      expediente_pensional_aplica: null,
    },
  });

  const conciliable      = watch("conciliable");
  const pretension       = watch("pretension");
  const cuantiaTipo      = watch("cuantia_tipo");
  const hayFallo         = watch("hay_fallo");
  const mostrarTasas     = pretension === "vejez" || pretension === "invalidez";

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

  // Resetear clase al cambiar pretensión
  useEffect(() => {
    setValue("clase_pretension", "");
  }, [pretension, setValue]);

  // Aplicar valores pre-llenados desde PDFs cuando cambian
  useEffect(() => {
    if (!valoresPrellenados || valoresPrellenados === prevPrellenados.current) return;
    prevPrellenados.current = valoresPrellenados;
    (Object.entries(valoresPrellenados) as [keyof ParametrosFormData, unknown][]).forEach(
      ([key, val]) => {
        if (val !== null && val !== undefined) {
          setValue(key, val as never, { shouldDirty: true });
        }
      }
    );
  }, [valoresPrellenados, setValue]);

  const clasesDisponibles = (CLASES_POR_PRETENSION[pretension] ?? []).map((c) => ({
    value: c,
    label: c,
  }));

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

  async function onSubmit(data: ParametrosFormData) {
    setGenerando(true);
    setError(null);

    try {
      const res = await fetch("/api/generar-ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caso_id: casoId, params: data }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Error al generar la ficha");
      }

      const { ficha_id } = await res.json();
      router.push(`/generador/${casoId}/ficha?ficha_id=${ficha_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setGenerando(false);
    }
  }

  const pretensionOpts = [
    { value: "vejez",           label: "Vejez" },
    { value: "invalidez",       label: "Invalidez" },
    { value: "sobrevivientes",  label: "Sobrevivientes" },
    { value: "indemnizacion",   label: "Indemnización sustitutiva" },
    { value: "devolucion",      label: "Devolución de saldos" },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* ── Bloque 0: Documentos previos ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Header del bloque */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-muted/30">
          <div className="w-6 h-6 rounded-full bg-[#1a4a8a]/10 border border-[#1a4a8a]/20 flex items-center justify-center shrink-0">
            <FileSignature className="w-3.5 h-3.5 text-[#1a4a8a]" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Documentos previos</h3>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Generar Poder de Sustitución */}
          <div className="rounded-lg border border-[#1a4a8a]/30 bg-[#1a4a8a]/5 px-4 py-3">
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
                <button
                  type="button"
                  disabled={generandoPoder}
                  onClick={handleGenerarPoder}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#1a4a8a] text-white hover:bg-[#163d73] transition-colors shrink-0 disabled:opacity-60"
                >
                  {generandoPoder
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
                    : <><FileSignature className="w-3.5 h-3.5" /> Generar Poder</>
                  }
                </button>
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
                          : "bg-destructive text-white"
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
                <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 px-4 py-3 space-y-3">
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
                      <button
                        type="button"
                        disabled={generandoMemorial}
                        onClick={handleGenerarMemorial}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-60"
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
                    <div className="border-t border-orange-200 dark:border-orange-800 pt-3 space-y-2">
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
                          <p className="text-[11px] font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide">
                            Enviar documentos
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <a
                              href="https://siugj.ramajudicial.gov.co/principalPortal/index.php"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => setEnvioUsado("portal")}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#1a4a8a] text-[#1a4a8a] bg-white dark:bg-card hover:bg-[#1a4a8a] hover:text-white transition-colors text-xs font-semibold flex-1"
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
                        className="text-xs font-semibold text-[#1a4a8a] hover:underline"
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

      {/* ── Bloque 1: Conciliabilidad ── */}
      <Bloque numero={1} titulo="Conciliabilidad">
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

      {/* ── Bloque 2: Pretensión ── */}
      <Bloque numero={2} titulo="Pretensión">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Pretensión" required error={errors.pretension?.message}>
            <Controller
              name="pretension"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  options={pretensionOpts}
                  error={errors.pretension?.message}
                />
              )}
            />
          </Campo>

          <Campo label="Clase" required error={errors.clase_pretension?.message}>
            <Controller
              name="clase_pretension"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Selecciona la clase..."
                  options={clasesDisponibles}
                  error={errors.clase_pretension?.message}
                />
              )}
            />
          </Campo>
        </div>

        <Campo label="Número de resolución (SUB o equivalente)">
          <Controller
            name="resolucion_prestacion"
            control={control}
            render={({ field }) => (
              <Input {...field} value={field.value ?? ""} placeholder="Ej: SUB-123456" />
            )}
          />
        </Campo>

        <Campo label="Semanas cotizadas">
          <Controller
            name="semanas_cotizadas"
            control={control}
            render={({ field }) => (
              <Input
                type="number"
                min={0}
                placeholder="Ej: 1300"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
              />
            )}
          />
        </Campo>

        {mostrarTasas && (
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Tasa aplicada (%)" error={errors.tasa_aplicada?.message}>
              <Controller
                name="tasa_aplicada"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="Ej: 45.00"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  />
                )}
              />
            </Campo>

            <Campo label="Tasa solicitada (%)" error={errors.tasa_solicitada?.message}>
              <Controller
                name="tasa_solicitada"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="Ej: 75.00"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  />
                )}
              />
            </Campo>
          </div>
        )}
      </Bloque>

      {/* ── Bloque 3: Cuantía ── */}
      <Bloque numero={3} titulo="Cuantía">
        <Campo label="Tipo de cuantía" required error={errors.cuantia_tipo?.message}>
          <Controller
            name="cuantia_tipo"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: "indeterminada", label: "Indeterminada" },
                  { value: "determinada",   label: "Determinada" },
                ]}
              />
            )}
          />
        </Campo>

        {cuantiaTipo === "determinada" && (
          <Campo label="Valor de la cuantía (COP)" required error={errors.cuantia_valor?.message}>
            <Controller
              name="cuantia_valor"
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  min={0}
                  placeholder="Ej: 15000000"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                />
              )}
            />
          </Campo>
        )}

        {cuantiaTipo === "indeterminada" && (
          <p className="text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-md">
            La sección 3 se generará con el texto legal estándar de cuantía indeterminada (art. 20 C.G.P.)
          </p>
        )}
      </Bloque>

      {/* ── Bloque 4: Pretensiones adicionales ── */}
      <Bloque numero={4} titulo="Pretensiones adicionales">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Campo label="¿Intereses moratorios?" required>
            <Controller
              name="pretende_intereses"
              control={control}
              render={({ field }) => (
                <Toggle value={field.value} onChange={field.onChange} />
              )}
            />
            <p className="text-xs text-muted-foreground">Afecta secciones 2 y 4</p>
          </Campo>

          <Campo label="¿Indexación?" required>
            <Controller
              name="pretende_indexacion"
              control={control}
              render={({ field }) => (
                <Toggle value={field.value} onChange={field.onChange} />
              )}
            />
            <p className="text-xs text-muted-foreground">Afecta secciones 2 y 4</p>
          </Campo>
        </div>
      </Bloque>

      {/* ── Bloque 5: Tipo de proceso ── */}
      <Bloque numero={5} titulo="Tipo de proceso">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Jurisdicción" required error={errors.jurisdiccion?.message}>
            <Controller
              name="jurisdiccion"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "ordinaria",    label: "Ordinaria Laboral" },
                    { value: "contencioso",  label: "Contencioso Administrativa" },
                  ]}
                />
              )}
            />
          </Campo>

          <Campo label="Tipo de conciliación" required>
            <Controller
              name="tipo_conciliacion"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: "parametrica",  label: "Paramétrica" },
                    { value: "condicional",  label: "Condicional" },
                  ]}
                />
              )}
            />
          </Campo>
        </div>

        <Campo label="¿Hay fallo de primera instancia?">
          <Controller
            name="hay_fallo"
            control={control}
            render={({ field }) => (
              <Toggle value={field.value} onChange={field.onChange} />
            )}
          />
        </Campo>

        {hayFallo && (
          <Campo label="Síntesis del fallo" required error={errors.sintesis_fallo?.message}>
            <Controller
              name="sintesis_fallo"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  value={field.value ?? ""}
                  rows={4}
                  placeholder="Resumen del fallo de primera instancia..."
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring",
                    errors.sintesis_fallo ? "border-destructive" : "border-input"
                  )}
                />
              )}
            />
            {errors.sintesis_fallo && (
              <p className="text-xs text-destructive">{errors.sintesis_fallo.message}</p>
            )}
          </Campo>
        )}

        {!hayFallo && (
          <p className="text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded-md">
            Sin fallo: las secciones 5 y 6 usarán texto por defecto "proceso sin fallo".
          </p>
        )}

        <Campo label="Fecha de la diligencia">
          <Controller
            name="fecha_diligencia"
            control={control}
            render={({ field }) => (
              <Input
                type="date"
                value={field.value ?? ""}
                onChange={(e) => field.onChange(e.target.value || null)}
              />
            )}
          />
          <p className="text-xs text-muted-foreground">Fecha de la audiencia de conciliación</p>
        </Campo>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Expediente pensional en Bizagi">
            <Controller
              name="expediente_pensional_aplica"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Selecciona..."
                  options={[
                    { value: "SI",        label: "SÍ — Aparece en Bizagi" },
                    { value: "NO",        label: "NO — No aparece en Bizagi" },
                    { value: "NO APLICA", label: "NO APLICA" },
                  ]}
                />
              )}
            />
          </Campo>

          <Campo label="Caducidad">
            <Controller
              name="caducidad"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="Selecciona..."
                  options={[
                    { value: "SI",        label: "SÍ — Opera la caducidad" },
                    { value: "NO",        label: "NO — No opera" },
                    { value: "NO APLICA", label: "NO APLICA — Proceso ordinario" },
                  ]}
                />
              )}
            />
          </Campo>
        </div>
      </Bloque>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full h-11" disabled={generando}>
        {generando ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generando ficha con IA...
          </>
        ) : (
          <>
            Generar ficha <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </form>
  );
}

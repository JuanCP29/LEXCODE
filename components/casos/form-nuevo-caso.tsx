"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUploadField } from "@/components/casos/file-upload-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Loader2, ChevronRight } from "lucide-react";

// ── Opciones ──────────────────────────────────────────────────────────────────
const PRETENSIONES = [
  { value: "vejez",          label: "Pensión de Vejez" },
  { value: "invalidez",      label: "Pensión de Invalidez" },
  { value: "sobrevivientes", label: "Pensión de Sobrevivientes" },
  { value: "indemnizacion",  label: "Indemnización Sustitutiva" },
  { value: "devolucion",     label: "Devolución de Saldos" },
];

const CLASES_POR_PRETENSION: Record<string, string[]> = {
  vejez:          ["Reconocimiento", "Reliquidación", "Reajuste"],
  invalidez:      ["Reconocimiento", "Reliquidación", "Revisión"],
  sobrevivientes: ["Reconocimiento", "Sustitución"],
  indemnizacion:  ["Reconocimiento"],
  devolucion:     ["Reconocimiento"],
};

const JURISDICCIONES = [
  { value: "ordinaria",   label: "Ordinaria Laboral" },
  { value: "contencioso", label: "Contencioso Administrativo" },
];

// ── Componentes internos ──────────────────────────────────────────────────────
function Bloque({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden card-shadow">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/30">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-primary">{n}</span>
        </div>
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Campo({
  label,
  required,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

function Select({
  name,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "w-full h-9 px-3 rounded-md border border-input bg-background text-foreground text-sm",
        "focus:outline-none focus:ring-1 focus:ring-ring transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
    >
      <option value="">{placeholder ?? "Selecciona..."}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Formulario ────────────────────────────────────────────────────────────────
export function FormNuevoCaso() {
  const router = useRouter();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [pretension, setPretension] = useState("");
  const [clase, setClase]           = useState("");
  const [jurisdiccion, setJurisdiccion] = useState("");

  const clasesDisponibles = pretension ? CLASES_POR_PRETENSION[pretension] ?? [] : [];

  function validate(fd: FormData): boolean {
    const errs: Record<string, string> = {};
    if (!fd.get("radicado"))          errs.radicado = "El radicado es obligatorio";
    if (!fd.get("nombre_demandante")) errs.nombre_demandante = "El nombre del demandante es obligatorio";
    if (!fd.get("demanda_pdf"))       errs.demanda_pdf = "La demanda en PDF es obligatoria";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (!validate(fd)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/casos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al crear el caso"); return; }
      router.push(`/generador/${data.caso_id}/params`);
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">

      {/* ── Bloque 1: Identificación ─────────────────────────────────────── */}
      <Bloque n={1} label="Identificación del proceso">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Campo label="Número de radicado" required error={errors.radicado}>
            <Input
              name="radicado"
              placeholder="Ej. 76001-31-05-001-2023-00421"
              className="font-mono"
            />
          </Campo>

          <Campo label="Radicado Bizagi">
            <Input name="radicado_bizagi" placeholder="Ej. 2023-456789" />
          </Campo>

          <Campo label="Nombre del demandante" required error={errors.nombre_demandante}>
            <Input name="nombre_demandante" placeholder="Nombre completo" />
          </Campo>

          <Campo label="Cédula del demandante">
            <Input name="cedula_demandante" placeholder="Número de cédula" inputMode="numeric" />
          </Campo>

          <Campo label="Expediente pensional">
            <Input name="expediente_pensional" placeholder="Número de expediente" />
          </Campo>

          <Campo label="Despacho / Autoridad judicial">
            <Input name="despacho" placeholder="Ej. Juzgado 5 Laboral del Circuito de Cali" />
          </Campo>

        </div>
      </Bloque>

      {/* ── Bloque 2: Clasificación ───────────────────────────────────────── */}
      <Bloque n={2} label="Clasificación del caso">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Campo label="Pretensión principal">
            <Select
              name="pretension"
              value={pretension}
              onChange={(v) => { setPretension(v); setClase(""); }}
              options={PRETENSIONES}
              placeholder="Selecciona una pretensión"
            />
          </Campo>

          <Campo label="Clase de pretensión">
            <Select
              name="clase_pretension"
              value={clase}
              onChange={setClase}
              options={clasesDisponibles.map((c) => ({ value: c, label: c }))}
              placeholder={pretension ? "Selecciona..." : "Primero elige la pretensión"}
              disabled={!pretension}
            />
          </Campo>

          <Campo label="Jurisdicción">
            <Select
              name="jurisdiccion"
              value={jurisdiccion}
              onChange={setJurisdiccion}
              options={JURISDICCIONES}
              placeholder="Selecciona la jurisdicción"
            />
          </Campo>

        </div>
      </Bloque>

      {/* ── Bloque 3: Documentos ─────────────────────────────────────────── */}
      <Bloque n={3} label="Documentos del proceso">
        <p className="text-xs text-muted-foreground mb-5 -mt-1">
          La IA usará estos archivos para generar la ficha de conciliación.
        </p>
        <div className="space-y-4">
          <div>
            <FileUploadField
              name="demanda_pdf"
              label="Demanda (PDF)"
              accept=".pdf"
              required
              icon="pdf"
              hint="PDF de la demanda principal"
            />
            {errors.demanda_pdf && (
              <p className="text-xs text-destructive mt-1">{errors.demanda_pdf}</p>
            )}
          </div>

          <FileUploadField
            name="excel_proceso"
            label="Movimientos del proceso (Excel)"
            accept=".xlsx,.xls"
            icon="excel"
            hint="Reporte de movimientos o historia laboral"
          />

          <FileUploadField
            name="lineamientos"
            label="Lineamientos institucionales (PDF)"
            accept=".pdf"
            icon="pdf"
            hint="Directrices internas de conciliación"
          />
        </div>
      </Bloque>

      {/* ── Error global ──────────────────────────────────────────────────── */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Acciones ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creando caso...</>
          ) : (
            <>Crear caso y continuar <ChevronRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>

    </form>
  );
}

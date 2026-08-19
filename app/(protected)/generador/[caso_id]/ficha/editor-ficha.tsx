"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { SECCIONES, BADGE_TIPO, generarTextoDefault } from "@/lib/ia/secciones";
import { CajaIA } from "@/components/fichas/caja-ia";
import { VistaPreviaFicha } from "@/components/fichas/vista-previa-ficha";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, FileSpreadsheet, FileDown, Save, Loader2, CheckCircle2, RotateCcw, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Caso {
  id: string;
  radicado: string;
  nombre_demandante: string;
  pretension: string | null;
  clase_pretension: string | null;
  jurisdiccion: string | null;
}

interface FichaInicial extends Record<string, unknown> {
  id: string;
  hay_fallo?: boolean;
  conciliable?: boolean;
  tipo_conciliacion?: string;
}

interface EditorFichaProps {
  caso: Caso;
  fichaInicial: FichaInicial | null;
}

export function EditorFicha({ caso, fichaInicial }: EditorFichaProps) {
  const supabase = createClient();

  // Estado de todas las secciones. Las ocultas/estandarizadas toman su texto fijo.
  const [secciones, setSecciones] = useState<Record<string, string>>(() => {
    const vals: Record<string, string> = {};
    SECCIONES.forEach((s) => {
      if (s.oculta && s.textoFijo) { vals[s.key] = s.textoFijo; return; }
      vals[s.key] = fichaInicial ? String(fichaInicial[s.key] ?? "") : "";
    });
    return vals;
  });

  // Secciones visibles en el editor (excluye las ocultas/estandarizadas)
  const SECCIONES_VISIBLES = SECCIONES.filter((s) => !s.oculta);

  const [seccionActiva, setSeccionActiva] = useState(SECCIONES[0].key);
  const [guardando, setGuardando] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(fichaInicial?.id ?? null);
  const [mensajeGuardado, setMensajeGuardado] = useState("");
  const [estadoFicha, setEstadoFicha] = useState<string>(String(fichaInicial?.estado ?? "borrador"));
  const [aprobando, setAprobando] = useState(false);
  const [errorAprobacion, setErrorAprobacion] = useState<string | null>(null);
  const [previewAbierto, setPreviewAbierto] = useState(false);
  const seccionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const estaAprobada = estadoFicha === "aprobada" || estadoFicha === "exportada" || estadoFicha === "listo";

  // Nombre de archivo estructurado y editable:
  // AAAAMMDD_FichaConciliacion_<Demandante>_Rad_<radicado>
  const [nombreArchivo, setNombreArchivo] = useState<string>(() => {
    const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const demandante = (caso.nombre_demandante ?? "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")   // quitar tildes
      .replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
    const rad = (caso.radicado ?? "SIN_RADICADO").replace(/[^a-zA-Z0-9]/g, "");
    return `${fecha}_FichaConciliacion_${demandante}_Rad_${rad}`;
  });

  function handleChange(key: string, valor: string) {
    setSecciones((prev) => ({ ...prev, [key]: valor }));
  }

  function scrollASeccion(key: string) {
    setSeccionActiva(key);
    seccionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function descargar(url: string, nombreArchivo: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        alert(`Error exportando: ${err.error}`);
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = nombreArchivo;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : "Error desconocido"}`);
    }
  }

  async function handleGuardar() {
    setGuardando(true);
    setMensajeGuardado("");

    try {
      const data = { ...secciones, caso_id: caso.id, creado_por: (await supabase.auth.getUser()).data.user?.id };

      if (fichaId) {
        await supabase.from("fichas_conciliacion").update(secciones).eq("id", fichaId);
      } else {
        const { data: nueva } = await supabase
          .from("fichas_conciliacion")
          .insert({ ...secciones, caso_id: caso.id, creado_por: (await supabase.auth.getUser()).data.user?.id })
          .select("id")
          .single();
        if (nueva) setFichaId(nueva.id);
      }
      setMensajeGuardado("Guardado");
      setTimeout(() => setMensajeGuardado(""), 2000);
    } finally {
      setGuardando(false);
    }
  }

  async function handleAprobar() {
    if (!fichaId) return;
    setAprobando(true);
    setErrorAprobacion(null);
    try {
      // Guardar primero para que la validación evalúe el contenido actual
      await supabase.from("fichas_conciliacion").update(secciones).eq("id", fichaId);

      const res = await fetch(`/api/fichas/${fichaId}/aprobar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "aprobar" }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.faltantes) {
          setErrorAprobacion(
            `Secciones obligatorias sin contenido: ${body.faltantes.map((f: { seccion: number }) => f.seccion).join(", ")}`
          );
        } else {
          setErrorAprobacion(body.error ?? "Error al aprobar");
        }
        return;
      }
      setEstadoFicha(body.estado);
    } finally {
      setAprobando(false);
    }
  }

  async function handleReabrir() {
    if (!fichaId) return;
    const res = await fetch(`/api/fichas/${fichaId}/aprobar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "reabrir" }),
    });
    if (res.ok) {
      const body = await res.json();
      setEstadoFicha(body.estado);
    }
  }

  async function handleRegenerar(key: string) {
    // Regenerar una sección específica vía API
    const res = await fetch("/api/regenerar-seccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caso_id: caso.id, ficha_id: fichaId, seccion_key: key }),
    });
    if (res.ok) {
      const { contenido } = await res.json();
      handleChange(key, contenido);
    }
  }

  const optsDefault = {
    hay_fallo: Boolean(fichaInicial?.hay_fallo),
    jurisdiccion: caso.jurisdiccion,
    pretension: caso.pretension,
    conciliable: fichaInicial?.conciliable !== false && fichaInicial?.conciliable != null,
    tipo_conciliacion: String(fichaInicial?.tipo_conciliacion ?? "parametrica"),
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6 overflow-hidden">
      {/* Sidebar de 19 secciones */}
      <aside className="w-56 shrink-0 border-r border-border bg-muted/20 overflow-y-auto flex flex-col">
        <div className="px-3 pt-4 pb-2">
          <Link href={`/generador/${caso.id}/params`}>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft className="w-3 h-3" /> Parámetros
            </button>
          </Link>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Secciones
          </p>
        </div>

        <nav className="flex-1 px-2 pb-4 space-y-0.5">
          {SECCIONES_VISIBLES.map((s) => {
            const badge = BADGE_TIPO[s.tipo];
            const activa = seccionActiva === s.key;
            const tieneContenido = !!secciones[s.key];

            return (
              <button
                key={s.key}
                onClick={() => scrollASeccion(s.key)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2",
                  activa
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", tieneContenido ? "bg-green-500" : "bg-border")} />
                <span className="flex-1 truncate">{s.numero}. {s.label.replace(/\d+\.\s/, "")}</span>
                <span className={cn("text-[10px] px-1 rounded border shrink-0", badge.clase)}>
                  {badge.label.charAt(0)}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar del editor */}
        <div className="shrink-0 border-b border-border px-6 py-3 flex items-center justify-between bg-background">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-semibold font-mono">{caso.radicado}</p>
              <p className="text-xs text-muted-foreground">{caso.nombre_demandante}</p>
            </div>
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
              estaAprobada
                ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
            )}>
              {estaAprobada && <CheckCircle2 className="w-2.5 h-2.5" />}
              {estadoFicha === "exportada" ? "Exportada" : estaAprobada ? "Aprobada" : estadoFicha === "en_revision" ? "En revisión" : "Borrador"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {mensajeGuardado && (
              <span className="text-xs text-green-600 font-medium">{mensajeGuardado}</span>
            )}
            <Button size="sm" variant="outline" onClick={handleGuardar} disabled={guardando}>
              {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Guardar
            </Button>
            {fichaId && !estaAprobada && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleAprobar}
                disabled={aprobando}
              >
                {aprobando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                Aprobar
              </Button>
            )}
            {fichaId && estaAprobada && estadoFicha !== "exportada" && (
              <Button size="sm" variant="outline" onClick={handleReabrir}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabrir
              </Button>
            )}
            {fichaId && (
              <>
                <Button size="sm" variant="outline" onClick={() => setPreviewAbierto(true)}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> Vista previa
                </Button>
                <Button
                  size="sm"
                  className="bg-[#1a4a8a] hover:bg-[#163d73] text-white"
                  onClick={() => descargar(`/api/exportar-ficha-pdf/${fichaId}`, `${nombreArchivo || "FICHA_CONCILIACION"}.pdf`)}
                >
                  <FileDown className="w-3.5 h-3.5 mr-1" /> Exportar PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => descargar(`/api/exportar-ficha/${fichaId}`, `${nombreArchivo || "FICHA_CONCILIACION"}.docx`)}
                >
                  <FileText className="w-3.5 h-3.5 mr-1" /> .docx
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                  onClick={() => descargar(`/api/exportar-ficha-xlsx/${fichaId}`, `${nombreArchivo || "FICHA_CONCILIACION"}.xlsx`)}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> .xlsx
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Nombre de archivo editable */}
        {fichaId && (
          <div className="shrink-0 px-6 py-2 border-b border-border bg-muted/10 flex items-center gap-2">
            <label className="text-xs text-muted-foreground shrink-0">Nombre de archivo</label>
            <input
              value={nombreArchivo}
              onChange={(e) => setNombreArchivo(e.target.value)}
              spellCheck={false}
              className="flex-1 max-w-xl rounded-md border border-input bg-background px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-[11px] text-muted-foreground shrink-0">.docx / .xlsx</span>
          </div>
        )}

        {/* Error de aprobación */}
        {errorAprobacion && (
          <div className="shrink-0 px-6 py-2 bg-destructive/10 border-b border-destructive/30">
            <p className="text-xs text-destructive font-medium">{errorAprobacion}</p>
          </div>
        )}

        {/* Secciones scrollables */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {SECCIONES_VISIBLES.map((s) => {
            const valorActual = secciones[s.key] ||
              (s.tipo === "DEFAULT" ? generarTextoDefault(s.key, optsDefault) : "");

            if (s.tipo === "DEFAULT" && !secciones[s.key]) {
              // Prellenar DEFAULT si aún no hay valor
              setTimeout(() => handleChange(s.key, valorActual), 0);
            }

            return (
              <div
                key={s.key}
                ref={(el) => { seccionRefs.current[s.key] = el; }}
                onClick={() => setSeccionActiva(s.key)}
              >
                <CajaIA
                  seccionKey={s.key}
                  tipo={s.tipo}
                  label={`${s.numero}. ${s.label}`}
                  descripcion={s.descripcion}
                  valor={valorActual}
                  onChange={(v) => handleChange(s.key, v)}
                  onRegenerar={s.tipo === "AUTO" ? () => handleRegenerar(s.key) : undefined}
                  esCritica={["sec_16_consideraciones", "sec_17_riesgo", "sec_18_recomendacion"].includes(s.key)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de vista previa */}
      <VistaPreviaFicha
        abierto={previewAbierto}
        onClose={() => setPreviewAbierto(false)}
        secciones={secciones}
        encabezado={{
          fecha_diligencia:  (fichaInicial?.fecha_diligencia as string) ?? "",
          radicado_bizagi:   (fichaInicial?.radicado_bizagi as string) ?? "",
          radicado:          caso.radicado,
          nombre_demandante: caso.nombre_demandante,
          causante_afiliado: (fichaInicial?.causante_afiliado as string) ?? "",
          demandado:         (fichaInicial?.demandado as string) ?? "",
          despacho:          (fichaInicial?.despacho as string) ?? "",
          juez:              (fichaInicial?.juez as string) ?? "",
          caducidad:         (fichaInicial?.caducidad as string) ?? "",
          reconsideracion:   (fichaInicial?.reconsideracion as string) ?? "",
        }}
      />
    </div>
  );
}

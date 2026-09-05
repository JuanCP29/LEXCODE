"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bloque, Campo, ModuloTexto } from "@/components/fichas/bloques-ficha";
import { Sparkles, Save, Loader2, CheckCircle2, AlertCircle, FileText, FileDown } from "lucide-react";

type Seccion = "hechos" | "pretensiones" | "defensa";

const SECCIONES: {
  key: Seccion;
  col: "sec_hechos" | "sec_pretensiones" | "sec_defensa";
  titulo: string;
  label: string;
  ayuda: string;
}[] = [
  { key: "hechos",       col: "sec_hechos",       titulo: "Pronunciamiento frente a los hechos",       label: "Pronunciamiento frente a los hechos de la demanda",       ayuda: "Responde a cada hecho (ES CIERTO / NO ES CIERTO / NO ME CONSTA)." },
  { key: "pretensiones", col: "sec_pretensiones", titulo: "Pronunciamiento frente a las pretensiones", label: "Pronunciamiento frente a las pretensiones de la demanda", ayuda: "Oposición a cada pretensión («ME OPONGO, a que…, toda vez que…»)." },
  { key: "defensa",      col: "sec_defensa",      titulo: "Hechos, fundamentos y razones de la defensa", label: "Hechos, fundamentos y razones de la defensa",            ayuda: "Fundamentos de derecho de la defensa de Colpensiones." },
];

interface Props {
  casoId: string;
  inicial: { sec_hechos: string; sec_pretensiones: string; sec_defensa: string };
}

export function EditorContestacion({ casoId, inicial }: Props) {
  const [texto, setTexto] = useState<Record<string, string>>({
    sec_hechos: inicial.sec_hechos,
    sec_pretensiones: inicial.sec_pretensiones,
    sec_defensa: inicial.sec_defensa,
  });
  // Última sugerencia IA por sección (para la marca "editado" y restaurar).
  const [sugeridos, setSugeridos] = useState<Record<string, string | null>>({
    sec_hechos: null, sec_pretensiones: null, sec_defensa: null,
  });
  const [generando, setGenerando] = useState<Record<Seccion, boolean>>({ hechos: false, pretensiones: false, defensa: false });
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [exportando, setExportando] = useState<"docx" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persistir() {
    const res = await fetch("/api/guardar-contestacion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caso_id: casoId,
        sec_hechos: texto.sec_hechos.trim() || null,
        sec_pretensiones: texto.sec_pretensiones.trim() || null,
        sec_defensa: texto.sec_defensa.trim() || null,
      }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error al guardar");
  }

  async function exportar(formato: "docx" | "pdf") {
    setExportando(formato);
    setError(null);
    try {
      await persistir(); // exporta el contenido actual
      const url = formato === "docx" ? `/api/exportar-contestacion/${casoId}` : `/api/exportar-contestacion-pdf/${casoId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("No se pudo exportar el documento");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `CONTESTACION_DDA.${formato}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setExportando(null);
    }
  }

  async function generar(seccion: Seccion, col: string) {
    setGenerando((g) => ({ ...g, [seccion]: true }));
    setError(null);
    try {
      const res = await fetch("/api/generar-contestacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caso_id: casoId, seccion }),
      });
      // Si el servidor corta la función (timeout), la respuesta no es JSON.
      let json: { error?: string; texto?: string } = {};
      try { json = await res.json(); } catch { json = {}; }
      if (!res.ok) {
        throw new Error(
          json.error ??
          (res.status === 504 || res.status === 502
            ? "La generación tardó demasiado y el servidor la interrumpió. Intenta de nuevo."
            : `El servidor respondió ${res.status}.`)
        );
      }
      const texto = json.texto;
      if (texto) {
        setTexto((t) => ({ ...t, [col]: texto }));
        setSugeridos((s) => ({ ...s, [col]: texto }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar");
    } finally {
      setGenerando((g) => ({ ...g, [seccion]: false }));
    }
  }

  async function generarTodo() {
    await Promise.all(SECCIONES.map((s) => generar(s.key, s.col)));
  }

  async function guardar() {
    setGuardando(true);
    setGuardado(false);
    setError(null);
    try {
      await persistir();
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  const algunoGenerando = Object.values(generando).some(Boolean);

  return (
    <div className="space-y-6">
      {/* Barra de acciones */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={generarTodo} disabled={algunoGenerando}>
          {algunoGenerando ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando…</> : <><Sparkles className="w-4 h-4" /> Generar todo con IA</>}
        </Button>
        <Button onClick={guardar} variant="outline" disabled={guardando}>
          {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Save className="w-4 h-4" /> Guardar</>}
        </Button>
        {guardado && <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportar("pdf")} disabled={exportando !== null}>
            {exportando === "pdf" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando…</> : <><FileDown className="w-3.5 h-3.5" /> Descargar PDF</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportar("docx")} disabled={exportando !== null}>
            {exportando === "docx" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando…</> : <><FileText className="w-3.5 h-3.5" /> Descargar Word</>}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Secciones (mismo estilo que la Ficha) */}
      {SECCIONES.map((s) => (
        <Bloque key={s.key} icono={<FileText className="w-4 h-4" />} titulo={s.titulo}>
          <div className="flex items-center justify-between gap-3 -mt-1">
            <p className="text-[11px] text-muted-foreground">{s.ayuda}</p>
            <Button size="sm" variant="outline" onClick={() => generar(s.key, s.col)} disabled={generando[s.key]}>
              {generando[s.key] ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando…</> : <><Sparkles className="w-3.5 h-3.5" /> Generar</>}
            </Button>
          </div>
          <Campo label={`${s.label} (Contestación)`}>
            <ModuloTexto
              value={texto[s.col]}
              onChange={(v) => setTexto((t) => ({ ...t, [s.col]: v }))}
              sugerencia={sugeridos[s.col]}
              minHeight={180}
              placeholder="Pulsa «Generar» para redactar esta sección con IA, o escríbela manualmente."
            />
          </Campo>
        </Bloque>
      ))}
    </div>
  );
}

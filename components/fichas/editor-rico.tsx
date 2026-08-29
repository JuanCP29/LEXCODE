"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { ImagenRedimensionable } from "@/components/fichas/extension-imagen";
import { Bold, Italic, Underline as UnderlineIcon, RotateCcw, Pencil, Table as TableIcon, Rows3, Columns3, Trash2, ImagePlus, Loader2, AlignLeft, AlignCenter, AlignRight, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { esHtml, textoPlanoAHtml, htmlATextoPlano } from "@/lib/richtext/html";

function contarPalabras(s: string): number {
  const t = (s ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

// Ancho inicial de la imagen: su ancho natural, con tope de 480px.
function anchoInicial(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const im = new window.Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(Math.min(480, im.naturalWidth || 480)); };
    im.onerror = () => { URL.revokeObjectURL(url); resolve(480); };
    im.src = url;
  });
}

// Sube una imagen al bucket público y devuelve su URL (o null si falla).
async function subirImagen(file: File, casoId?: string): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append("file", file);
    if (casoId) fd.append("caso_id", casoId);
    const res = await fetch("/api/fichas/upload-imagen", { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Error al subir la imagen");
    return json.url as string;
  } catch (e) {
    console.error("subirImagen:", e);
    return null;
  }
}

/**
 * Editor de texto enriquecido (negrita, cursiva, subrayado) con barra flotante
 * sobre la selección (aparece solo al seleccionar texto, para no contaminar).
 * El valor entra/sale como HTML; también acepta texto plano heredado.
 */
export function EditorRico({ value, onChange, sugerencia, placeholder, minHeight = 160, maxHeight = 360, tablas = false, imagenes = false, casoId }: {
  value: string;
  onChange: (html: string) => void;
  sugerencia?: string | null;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  tablas?: boolean; // habilita insertar/editar tablas (solo donde se necesita)
  imagenes?: boolean; // habilita pegar/insertar imágenes
  casoId?: string; // carpeta de destino en Storage
}) {
  const [subiendo, setSubiendo] = useState(false);
  const inputImagen = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false, // evita desajuste de hidratación en Next
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      ...(tablas ? [Table.configure({ resizable: true }), TableRow, TableHeader, TableCell] : []),
      ...(imagenes ? [ImagenRedimensionable.configure({ inline: false, allowBase64: false })] : []),
    ],
    content: esHtml(value) ? value : textoPlanoAHtml(value),
    editorProps: {
      attributes: {
        class: "editor-rico-contenido focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
      // Pegar / soltar imágenes → subir a Storage e insertar la URL
      handlePaste: imagenes
        ? (_view, event) => {
            const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
            if (!files.length) return false;
            event.preventDefault();
            void insertarImagenes(files);
            return true;
          }
        : undefined,
      handleDrop: imagenes
        ? (_view, event) => {
            const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
            if (!files.length) return false;
            event.preventDefault();
            void insertarImagenes(files);
            return true;
          }
        : undefined,
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sube una o varias imágenes y las inserta con un ancho inicial razonable.
  async function insertarImagenes(files: File[]) {
    if (!editor) return;
    setSubiendo(true);
    try {
      for (const file of files) {
        const url = await subirImagen(file, casoId);
        if (!url) continue;
        const width = await anchoInicial(file);
        editor.chain().focus().setImage({ src: url, width } as { src: string; width?: number }).run();
      }
    } finally {
      setSubiendo(false);
    }
  }

  // Sincroniza cuando el valor cambia desde afuera (sugerencia IA, carga inicial).
  useEffect(() => {
    if (!editor) return;
    const objetivo = esHtml(value) ? value : textoPlanoAHtml(value);
    if (objetivo !== editor.getHTML()) {
      editor.commands.setContent(objetivo, false); // sin emitir update
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const palabras = editor ? contarPalabras(editor.getText()) : 0;
  const editado = !!(sugerencia && sugerencia.trim() && htmlATextoPlano(value).trim() !== htmlATextoPlano(sugerencia).trim());

  return (
    <div>
      {editor && (
        <BubbleMenu
          editor={editor}
          pluginKey="menuTexto"
          tippyOptions={{ duration: 120 }}
          shouldShow={({ editor, state }) => !state.selection.empty && !editor.isActive("image")}
          className="flex items-center gap-0.5 rounded-lg border border-border bg-popover shadow-lg p-1"
        >
          {([
            { cmd: () => editor.chain().focus().toggleBold().run(), activo: editor.isActive("bold"), Icon: Bold, titulo: "Negrita" },
            { cmd: () => editor.chain().focus().toggleItalic().run(), activo: editor.isActive("italic"), Icon: Italic, titulo: "Cursiva" },
            { cmd: () => editor.chain().focus().toggleUnderline().run(), activo: editor.isActive("underline"), Icon: UnderlineIcon, titulo: "Subrayado" },
          ]).map(({ cmd, activo, Icon, titulo }) => (
            <button
              key={titulo}
              type="button"
              title={titulo}
              onMouseDown={(e) => { e.preventDefault(); cmd(); }}
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                activo ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </BubbleMenu>
      )}

      {/* Barra flotante de imagen: alinear + ampliar/reducir (solo sobre la imagen) */}
      {editor && imagenes && (
        <BubbleMenu
          editor={editor}
          pluginKey="menuImagen"
          tippyOptions={{ duration: 120 }}
          shouldShow={({ editor }) => editor.isActive("image")}
          className="flex items-center gap-0.5 rounded-lg border border-border bg-popover shadow-lg p-1"
        >
          {([
            { align: "left" as const, Icon: AlignLeft, titulo: "Izquierda" },
            { align: "center" as const, Icon: AlignCenter, titulo: "Centrar" },
            { align: "right" as const, Icon: AlignRight, titulo: "Derecha" },
          ]).map(({ align, Icon, titulo }) => (
            <button
              key={align}
              type="button"
              title={titulo}
              onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().updateAttributes("image", { align }).run(); }}
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                editor.getAttributes("image").align === align ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            title="Reducir"
            onMouseDown={(e) => { e.preventDefault(); const w = Number(editor.getAttributes("image").width) || 300; editor.chain().focus().updateAttributes("image", { width: Math.max(60, Math.round(w * 0.85)) }).run(); }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Ampliar"
            onMouseDown={(e) => { e.preventDefault(); const w = Number(editor.getAttributes("image").width) || 300; editor.chain().focus().updateAttributes("image", { width: Math.round(w * 1.15) }).run(); }}
            className="w-7 h-7 rounded-md flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </BubbleMenu>
      )}

      {/* Barra de medios (tablas / imágenes) — solo donde se habilitan */}
      {editor && (tablas || imagenes) && (
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          {tablas && (
            <button
              type="button"
              title="Insertar tabla"
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <TableIcon className="w-3.5 h-3.5" /> Tabla
            </button>
          )}
          {imagenes && (
            <button
              type="button"
              title="Insertar imagen"
              disabled={subiendo}
              onClick={() => inputImagen.current?.click()}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
              {subiendo ? "Subiendo…" : "Imagen"}
            </button>
          )}
          {imagenes && (
            <input
              ref={inputImagen}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) void insertarImagenes(files);
                e.target.value = "";
              }}
            />
          )}
          {tablas && editor.isActive("table") && (
            <>
              <span className="w-px h-4 bg-border mx-0.5" />
              <button type="button" title="Agregar fila" onClick={() => editor.chain().focus().addRowAfter().run()} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Rows3 className="w-3.5 h-3.5" />+ fila</button>
              <button type="button" title="Agregar columna" onClick={() => editor.chain().focus().addColumnAfter().run()} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Columns3 className="w-3.5 h-3.5" />+ col</button>
              <button type="button" title="Eliminar fila" onClick={() => editor.chain().focus().deleteRow().run()} className="inline-flex items-center px-2 py-1 rounded-md text-[11px] border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">− fila</button>
              <button type="button" title="Eliminar columna" onClick={() => editor.chain().focus().deleteColumn().run()} className="inline-flex items-center px-2 py-1 rounded-md text-[11px] border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">− col</button>
              <button type="button" title="Eliminar tabla" onClick={() => editor.chain().focus().deleteTable().run()} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-border text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      )}

      <div
        className="rounded-xl border border-input bg-card px-3.5 py-3 focus-within:ring-2 focus-within:ring-ring/25 overflow-y-auto"
        style={{ maxHeight }}
      >
        <EditorContent editor={editor} className="text-sm leading-relaxed" />
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{palabras} palabra{palabras === 1 ? "" : "s"}</span>
        {editado && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <Pencil className="w-3 h-3" /> editado
          </span>
        )}
        {editado && (
          <button
            type="button"
            onClick={() => onChange(textoPlanoAHtml(sugerencia as string))}
            className="ml-auto inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <RotateCcw className="w-3 h-3" /> Restaurar sugerencia IA
          </button>
        )}
      </div>
    </div>
  );
}

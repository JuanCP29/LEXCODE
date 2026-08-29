"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { Bold, Italic, Underline as UnderlineIcon, RotateCcw, Pencil, Table as TableIcon, Rows3, Columns3, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { esHtml, textoPlanoAHtml, htmlATextoPlano } from "@/lib/richtext/html";

function contarPalabras(s: string): number {
  const t = (s ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Editor de texto enriquecido (negrita, cursiva, subrayado) con barra flotante
 * sobre la selección (aparece solo al seleccionar texto, para no contaminar).
 * El valor entra/sale como HTML; también acepta texto plano heredado.
 */
export function EditorRico({ value, onChange, sugerencia, placeholder, minHeight = 160, maxHeight = 360, tablas = false }: {
  value: string;
  onChange: (html: string) => void;
  sugerencia?: string | null;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  tablas?: boolean; // habilita insertar/editar tablas (solo donde se necesita)
}) {
  const editor = useEditor({
    immediatelyRender: false, // evita desajuste de hidratación en Next
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      ...(tablas ? [Table.configure({ resizable: true }), TableRow, TableHeader, TableCell] : []),
    ],
    content: esHtml(value) ? value : textoPlanoAHtml(value),
    editorProps: {
      attributes: {
        class: "editor-rico-contenido focus:outline-none",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

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
        <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }} className="flex items-center gap-0.5 rounded-lg border border-border bg-popover shadow-lg p-1">
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

      {/* Barra de tabla (insertar / editar) — solo donde se habilitan tablas */}
      {editor && tablas && (
        <div className="flex flex-wrap items-center gap-1 mb-1.5">
          <button
            type="button"
            title="Insertar tabla"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <TableIcon className="w-3.5 h-3.5" /> Tabla
          </button>
          {editor.isActive("table") && (
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

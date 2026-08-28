"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Underline as UnderlineIcon, RotateCcw, Pencil } from "lucide-react";
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
export function EditorRico({ value, onChange, sugerencia, placeholder, minHeight = 160 }: {
  value: string;
  onChange: (html: string) => void;
  sugerencia?: string | null;
  placeholder?: string;
  minHeight?: number;
}) {
  const editor = useEditor({
    immediatelyRender: false, // evita desajuste de hidratación en Next
    extensions: [StarterKit, Underline, Placeholder.configure({ placeholder: placeholder ?? "" })],
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
  const editado = !!(sugerencia && sugerencia.trim() && htmlATextoPlano(value).trim() !== sugerencia.trim());

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

      <div className="rounded-xl border border-input bg-card px-3.5 py-3 focus-within:ring-2 focus-within:ring-ring/25">
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

import Image from "@tiptap/extension-image";
import type { NodeViewRendererProps } from "@tiptap/core";

type Alineacion = "left" | "center" | "right";

/**
 * Imagen redimensionable y alineable dentro del editor.
 * - Guarda `width` (px) y `align` (left/center/right) como atributos, de modo que
 *   se serializan en el HTML (<img width data-align>) y el export puede respetarlos.
 * - NodeView con tirador en la esquina inferior derecha para arrastrar y redimensionar.
 */
export const ImagenRedimensionable = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const attr = el.getAttribute("width");
          if (attr) return parseInt(attr, 10) || null;
          const st = (el as HTMLElement).style?.width;
          return st ? parseInt(st, 10) || null : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
      align: {
        default: "left",
        parseHTML: (el) => (el.getAttribute("data-align") as Alineacion) || "left",
        renderHTML: (attrs) => ({ "data-align": attrs.align || "left" }),
      },
    };
  },

  addNodeView() {
    return (props: NodeViewRendererProps) => {
      const { editor, getPos } = props;
      let node = props.node;

      const aplicarAlineacion = (wrap: HTMLDivElement, align: Alineacion) => {
        wrap.style.justifyContent = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
      };

      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      aplicarAlineacion(wrapper, (node.attrs.align as Alineacion) || "left");

      const cont = document.createElement("div");
      cont.className = "img-nodo";
      cont.style.position = "relative";
      cont.style.display = "inline-block";
      cont.style.maxWidth = "100%";

      const img = document.createElement("img");
      img.src = node.attrs.src;
      if (node.attrs.alt) img.alt = node.attrs.alt;
      if (node.attrs.width) img.style.width = `${node.attrs.width}px`;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      cont.appendChild(img);

      const tirador = document.createElement("span");
      tirador.className = "img-resize-handle";
      cont.appendChild(tirador);

      tirador.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startW = img.offsetWidth;
        const onMove = (ev: MouseEvent) => {
          const w = Math.max(60, startW + (ev.clientX - startX));
          img.style.width = `${w}px`;
        };
        const onUp = (ev: MouseEvent) => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
          const w = Math.max(60, Math.round(startW + (ev.clientX - startX)));
          if (typeof getPos === "function") {
            editor.chain().focus().command(({ tr }) => {
              tr.setNodeMarkup(getPos() as number, undefined, { ...node.attrs, width: w });
              return true;
            }).run();
          }
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });

      wrapper.appendChild(cont);

      return {
        dom: wrapper,
        selectNode() { cont.classList.add("img-selected"); },
        deselectNode() { cont.classList.remove("img-selected"); },
        update(updated) {
          if (updated.type.name !== node.type.name) return false;
          node = updated;
          if (img.src !== updated.attrs.src) img.src = updated.attrs.src;
          img.style.width = updated.attrs.width ? `${updated.attrs.width}px` : "";
          aplicarAlineacion(wrapper, (updated.attrs.align as Alineacion) || "left");
          return true;
        },
      };
    };
  },
});

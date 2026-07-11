"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud, X, FileText, Sheet } from "lucide-react";

interface FileUploadFieldProps {
  name: string;
  label: string;
  accept: string;
  required?: boolean;
  icon?: "pdf" | "excel" | "doc";
  hint?: string;
  onChange?: (file: File | null) => void;
}

const iconMap = {
  pdf:   { Icon: FileText, color: "text-red-500" },
  excel: { Icon: Sheet,    color: "text-green-600" },
  doc:   { Icon: FileText, color: "text-blue-500" },
};

export function FileUploadField({
  name,
  label,
  accept,
  required,
  icon = "pdf",
  hint,
  onChange,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const { Icon, color } = iconMap[icon];

  function handleFile(f: File | null) {
    setFile(f);
    onChange?.(f);
    if (inputRef.current) {
      if (f) {
        const dt = new DataTransfer();
        dt.items.add(f);
        inputRef.current.files = dt.files;
      } else {
        inputRef.current.value = "";
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      {file ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/40">
          <Icon className={cn("w-5 h-5 shrink-0", color)} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleFile(null)}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-primary/5"
          )}
        >
          <UploadCloud className="w-6 h-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Arrastra el archivo o{" "}
            <span className="text-primary underline underline-offset-2">selecciona</span>
          </p>
          {hint && <p className="text-xs text-muted-foreground/60">{hint}</p>}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        required={required}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

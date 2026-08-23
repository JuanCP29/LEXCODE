import { cn } from "@/lib/utils";

export const FOQS_CYAN = "#35b9db";

// Marca "Q": anillo + cola, con arco cian (órbita) y destello. `ink` es el color de trazo.
export function FoqsMark({ className, ink = "#1c2733" }: { className?: string; ink?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden>
      <circle cx="45" cy="55" r="29" stroke={ink} strokeWidth="8" />
      <line x1="57" y1="67" x2="79" y2="89" stroke={ink} strokeWidth="8" strokeLinecap="round" />
      <path d="M18 44 A34 34 0 0 1 46 18" stroke={FOQS_CYAN} strokeWidth="8" strokeLinecap="round" />
      <path d="M85 11 L88.5 22 L99 25.5 L88.5 29 L85 40 L81.5 29 L71 25.5 L81.5 22 Z" fill={FOQS_CYAN} />
    </svg>
  );
}

// Logo completo: marca + wordmark serif "FoQs".
export function FoqsLogo({
  className,
  tone = "light",
  size = "md",
}: {
  className?: string;
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}) {
  const ink = tone === "dark" ? "#ffffff" : "#1c2733";
  const txt = size === "lg" ? "text-4xl" : size === "sm" ? "text-lg" : "text-2xl";
  const mark = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-5 h-5" : "w-7 h-7";
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <FoqsMark className={cn(mark, "shrink-0")} ink={ink} />
      <span className={cn("font-bold tracking-tight leading-none", txt)} style={{ fontFamily: "var(--font-serif), Georgia, serif", color: ink }}>
        FoQs
      </span>
    </span>
  );
}

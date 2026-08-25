import { cn } from "@/lib/utils";

const TAMANOS = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
} as const;

const FOQS_CYAN = "#35b9db";

/**
 * Loader de marca FoQs: el anillo de la "Q" con un arco cian que gira
 * y la chispa que titila. Reemplaza al spinner genérico en estados de carga.
 * Respeta prefers-reduced-motion (queda estático).
 */
export function FoqsLoader({
  size = "md",
  className,
  label = "Cargando…",
}: {
  size?: keyof typeof TAMANOS;
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-block", TAMANOS[size], className)}>
      <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" aria-hidden>
        {/* Anillo base de la Q (tenue) */}
        <circle cx="45" cy="55" r="29" stroke="currentColor" strokeOpacity="0.2" strokeWidth="8" />
        {/* Cola de la Q (tenue) */}
        <line x1="57" y1="67" x2="79" y2="89" stroke="currentColor" strokeOpacity="0.2" strokeWidth="8" strokeLinecap="round" />
        {/* Arco cian que gira alrededor del anillo */}
        <circle
          cx="45"
          cy="55"
          r="29"
          stroke={FOQS_CYAN}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="52 200"
          className="origin-center animate-[spin_0.9s_linear_infinite] motion-reduce:animate-none"
          style={{ transformBox: "view-box", transformOrigin: "45px 55px" }}
        />
        {/* Chispa que titila */}
        <path
          d="M85 11 L88.5 22 L99 25.5 L88.5 29 L85 40 L81.5 29 L71 25.5 L81.5 22 Z"
          fill={FOQS_CYAN}
          className="animate-pulse motion-reduce:animate-none"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

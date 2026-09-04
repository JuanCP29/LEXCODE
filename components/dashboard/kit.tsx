import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

export function Saludo({ nombre }: { nombre: string }) {
  const hoy = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Hola, {nombre}</h1>
      <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays className="w-4 h-4 shrink-0" />
        <span className="capitalize">{hoy}</span>
      </p>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tint, sub, href }: {
  label: string; value: number | string; icon: React.ElementType; tint: string; sub?: string; href?: string;
}) {
  const inner = (
    <>
      <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: `${tint}1f` }}>
        <Icon className="w-5 h-5" style={{ color: tint }} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </>
  );
  const cls = "bg-card rounded-xl border border-border card-shadow-md px-5 py-5 flex items-center gap-4 transition-all";
  return href
    ? <Link href={href} className={`${cls} hover:-translate-y-0.5 hover:border-brand/30`}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}

export function SeccionCard({ icon: Icon, titulo, href, hrefLabel, children }: {
  icon: React.ElementType; titulo: string; href?: string; hrefLabel?: string; children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-xl border border-border card-shadow-md p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <Icon className="w-5 h-5 text-brand-ink" />
          <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        </div>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-brand-ink transition-colors">
            {hrefLabel ?? "Ver"} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// Barra horizontal simple para "documentos por X".
export function BarraDato({ label, valor, max, color = "#35b9db" }: { label: string; valor: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground truncate">{label}</span>
        <span className="text-muted-foreground tabular-nums shrink-0">{valor}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

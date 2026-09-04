interface CasosHeaderProps {
  total: number;
}

export function CasosHeader({ total }: CasosHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reparto</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {total} proceso{total !== 1 ? "s" : ""} a tu cargo
        </p>
      </div>
    </div>
  );
}

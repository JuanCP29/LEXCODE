/** Emblema de SIUGJ (cubos verdes isométricos). Solo presentacional. */
const TOP = "#9ccc65";
const LEFT = "#4e8a2a";
const RIGHT = "#6aab3c";

// Un cubo isométrico con vértice superior en (x,y).
function Cubo({ x, y }: { x: number; y: number }) {
  const a = 8, b = 4, c = 9;
  const T = `${x},${y}`;
  const R = `${x + a},${y + b}`;
  const Bm = `${x},${y + 2 * b}`;
  const L = `${x - a},${y + b}`;
  const Ld = `${x - a},${y + b + c}`;
  const Bd = `${x},${y + 2 * b + c}`;
  const Rd = `${x + a},${y + b + c}`;
  return (
    <g>
      <polygon points={`${L} ${Bm} ${Bd} ${Ld}`} fill={LEFT} />
      <polygon points={`${Bm} ${R} ${Rd} ${Bd}`} fill={RIGHT} />
      <polygon points={`${T} ${R} ${Bm} ${L}`} fill={TOP} />
    </g>
  );
}

export function SiugjIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      {/* dos cubos atrás (arriba), uno al frente (abajo) */}
      <Cubo x={16} y={15} />
      <Cubo x={32} y={15} />
      <Cubo x={24} y={19} />
    </svg>
  );
}

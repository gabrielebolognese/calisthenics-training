export interface Point {
  x: number;
  y: number;
}

/** Small hand-drawn SVG line chart (no chart library, brief §2). */
export function LineChart({
  points,
  target,
  xMax,
  xTicks = [8, 16, 24],
  label,
  unit = '',
}: {
  points: Point[];
  target?: number;
  xMax: number;
  xTicks?: number[];
  label: string;
  unit?: string;
}) {
  const W = 320;
  const H = 130;
  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 20;
  const ys = points.map((p) => p.y);
  const yMax = Math.max(1, ...ys, target ?? 0) * 1.12;
  const yMin = Math.min(0, ...ys);
  const x = (v: number) => padL + (v / Math.max(1, xMax)) * (W - padL - padR);
  const y = (v: number) => H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const sorted = [...points].sort((a, b) => a.x - b.x);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--line)" />
      {xTicks
        .filter((t) => t <= xMax)
        .map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={padT} y2={H - padB} stroke="var(--line)" strokeDasharray="2 4" />
            <text x={x(t)} y={H - 5} fill="var(--text-3)" fontSize="11" textAnchor="middle">
              w{t}
            </text>
          </g>
        ))}
      {target !== undefined && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(target)} y2={y(target)} stroke="var(--go)" strokeDasharray="5 5" opacity="0.6" />
          <text x={W - padR} y={y(target) - 4} fill="var(--go)" fontSize="11" textAnchor="end">
            target {target}
            {unit}
          </text>
        </g>
      )}
      {sorted.length > 1 && (
        <polyline points={sorted.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')} fill="none" stroke="var(--text)" strokeWidth="2" />
      )}
      {sorted.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.x)} cy={y(p.y)} r="4" fill="var(--text)" />
          <text x={x(p.x)} y={y(p.y) - 8} fill="var(--text-2)" fontSize="11" textAnchor="middle">
            {p.y}
          </text>
        </g>
      ))}
    </svg>
  );
}

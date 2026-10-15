import { useId } from 'react';

export interface Point {
  x: number;
  y: number;
}

/** Test points over the 24 weeks, with the target line (hand-drawn SVG, brief §2). */
export function LineChart({
  points,
  target,
  xMax,
  xTicks = [8, 16, 24],
  label,
  unit = '',
  color = 'var(--go)',
}: {
  points: Point[];
  target?: number;
  xMax: number;
  xTicks?: number[];
  label: string;
  unit?: string;
  color?: string;
}) {
  const id = `l${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const W = 340;
  const H = 140;
  const padL = 10;
  const padR = 10;
  const padT = 22;
  const padB = 22;
  const ys = points.map((p) => p.y);
  const yMax = Math.max(1, ...ys, target ?? 0) * 1.12;
  const yMin = Math.min(0, ...ys);
  const x = (v: number) => padL + (v / Math.max(1, xMax)) * (W - padL - padR);
  const y = (v: number) => H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const line = sorted.map((p) => `${x(p.x)},${y(p.y)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} className="axis" />
      {xTicks
        .filter((t) => t <= xMax)
        .map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={padT} y2={H - padB} className="grid" />
            <text x={x(t)} y={H - 6} className="chart-label" textAnchor={t === xMax ? 'end' : 'middle'}>
              Week {t}
            </text>
          </g>
        ))}
      {target !== undefined && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(target)} y2={y(target)} stroke="var(--text-3)" strokeDasharray="4 5" />
          <text x={padL} y={y(target) - 6} className="chart-label">
            Target {target}
            {unit}
          </text>
        </g>
      )}
      {sorted.length > 1 && (
        <>
          <polygon points={`${x(sorted[0]!.x)},${H - padB} ${line} ${x(sorted.at(-1)!.x)},${H - padB}`} fill={`url(#${id})`} />
          <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {sorted.map((p, i) => (
        <g key={i}>
          <circle cx={x(p.x)} cy={y(p.y)} r="4.5" fill="var(--bg)" stroke={color} strokeWidth="2.5" />
          <text x={x(p.x)} y={y(p.y) - 10} className="chart-value" textAnchor="middle">
            {p.y}
          </text>
        </g>
      ))}
    </svg>
  );
}

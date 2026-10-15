import { useId } from 'react';

// Small hand-drawn SVG charts (no chart library, brief §2).

const W = 340;

function useGradId(): string {
  return `g${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function Fade({ id, color, top = 0.38 }: { id: string; color: string; top?: number }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={top} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

export interface Pt {
  x: number;
  y: number;
}

/** Filled line, for running totals. */
export function AreaChart({
  points,
  color,
  label,
  format = String,
  start,
  end,
  height = 150,
  fit = false,
}: {
  points: Pt[];
  color: string;
  label: string;
  format?: (v: number) => string;
  start?: string;
  end?: string;
  height?: number;
  /** Scale y to the data instead of starting at zero (bodyweight). */
  fit?: boolean;
}) {
  const id = useGradId();
  const H = height;
  const padT = 26;
  const padB = start || end ? 24 : 8;
  const padX = 6;
  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(xMin + 1, ...xs);
  const ys = points.map((p) => p.y);
  const yMin = fit ? Math.min(...ys) - 1 : 0;
  const yMax = fit ? Math.max(...ys) + 1 : Math.max(1, ...ys);
  const x = (v: number) => padX + ((v - xMin) / (xMax - xMin)) * (W - padX * 2);
  const y = (v: number) => H - padB - ((v - yMin) / (yMax - yMin)) * (H - padT - padB);
  const pts = points.length === 1 ? [{ x: xMin - 1, y: fit ? points[0]!.y : 0 }, ...points] : points;
  const line = pts.map((p) => `${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const last = points.at(-1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
      <Fade id={id} color={color} />
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={padX} x2={W - padX} y1={padT + (H - padT - padB) * f} y2={padT + (H - padT - padB) * f} className="grid" />
      ))}
      <line x1={padX} x2={W - padX} y1={H - padB} y2={H - padB} className="axis" />
      {last && (
        <>
          <polygon points={`${x(pts[0]!.x)},${H - padB} ${line} ${x(last.x)},${H - padB}`} fill={`url(#${id})`} />
          <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last.x)} cy={y(last.y)} r="7" fill={color} opacity="0.25" />
          <circle cx={x(last.x)} cy={y(last.y)} r="4" fill={color} />
          <text x={Math.min(W - padX, Math.max(padX + 20, x(last.x)))} y={y(last.y) - 12} className="chart-value" textAnchor="end">
            {format(last.y)}
          </text>
        </>
      )}
      {start && (
        <text x={padX} y={H - 6} className="chart-label">
          {start}
        </text>
      )}
      {end && (
        <text x={W - padX} y={H - 6} className="chart-label" textAnchor="end">
          {end}
        </text>
      )}
    </svg>
  );
}

export interface Bar {
  label: string;
  value: number;
  current?: boolean;
}

/** Rounded bars; the current one is solid. */
export function BarChart({
  bars,
  color,
  label,
  format = String,
  height = 150,
}: {
  bars: Bar[];
  color: string;
  label: string;
  format?: (v: number) => string;
  height?: number;
}) {
  const id = useGradId();
  const H = height;
  const padT = 24;
  const padB = 22;
  const n = Math.max(bars.length, 6);
  const slot = W / n;
  const bw = Math.min(26, slot * 0.62);
  const yMax = Math.max(1, ...bars.map((b) => b.value));
  const every = bars.length > 12 ? Math.ceil(bars.length / 8) : 1;
  const peak = bars.reduce((m, b, i) => (b.value > (bars[m]?.value ?? -1) ? i : m), 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} className="axis" />
      {bars.map((b, i) => {
        const h = b.value > 0 ? Math.max(4, (b.value / yMax) * (H - padT - padB)) : 0;
        const cx = slot * i + slot / 2;
        const show = b.value > 0 && (i === peak || b.current);
        return (
          <g key={i}>
            <rect x={cx - bw / 2} y={H - padB - (h || 3)} width={bw} height={h || 3} rx={Math.min(7, bw / 2)} fill={h ? `url(#${id})` : 'var(--surface-3)'} opacity={b.current || !h ? 1 : 0.5} />
            {show && (
              <text x={cx} y={H - padB - h - 7} className="chart-value" textAnchor="middle">
                {format(b.value)}
              </text>
            )}
            {(i % every === 0 || b.current) && (
              <text x={cx} y={H - 6} className={`chart-label${b.current ? ' on' : ''}`} textAnchor="middle">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Tiny trend line for list rows. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const id = useGradId();
  const w = 76;
  const h = 32;
  if (values.length < 2) values = [0, ...values];
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const x = (i: number) => (i / (values.length - 1)) * (w - 4) + 2;
  const y = (v: number) => h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 8);
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="spark">
      <Fade id={id} color={color} top={0.3} />
      <polygon points={`2,${h} ${line} ${w - 2},${h}`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r="2.6" fill={color} />
    </svg>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div className="stepper">
      <button type="button" aria-label="Less" onClick={() => set(value - step)}>
        −
      </button>
      <div className="value num">
        {value}
        {unit && <span className="muted" style={{ fontSize: 22 }}> {unit}</span>}
      </div>
      <button type="button" aria-label="More" onClick={() => set(value + step)}>
        +
      </button>
    </div>
  );
}

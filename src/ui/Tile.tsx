import { Icon, type IconName } from './Icon';

/** A stat tile: icon, label, big value, small line under it. */
export function Tile({ icon, tone, label, value, sub }: { icon?: IconName; tone?: string; label: string; value: string; sub?: string }) {
  return (
    <div className={`tile ${tone ?? ''}`}>
      <div className="tile-head">
        {icon && (
          <span className="tile-icon">
            <Icon name={icon} size={17} strokeWidth={2.2} />
          </span>
        )}
        <span>{label}</span>
      </div>
      <div className="tile-value num">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  );
}

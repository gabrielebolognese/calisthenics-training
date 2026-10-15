import { Icon } from './Icon';

/** Large-title header: small eyebrow line, big title, settings gear or back button. */
export function Header({
  eyebrow,
  title,
  onSettings,
  onBack,
  backLabel = 'Back',
}: {
  eyebrow?: string;
  title: string;
  onSettings?: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="header">
      {onBack && (
        <button className="back" onClick={onBack}>
          <Icon name="back" size={22} strokeWidth={2.4} />
          {backLabel}
        </button>
      )}
      <div className="header-row">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>{title}</h1>
        </div>
        {onSettings && (
          <button className="round-btn" aria-label="Settings" onClick={onSettings}>
            <Icon name="gear" size={22} />
          </button>
        )}
      </div>
    </header>
  );
}

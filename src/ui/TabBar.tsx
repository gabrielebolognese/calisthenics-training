export type Tab = 'today' | 'progress' | 'log' | 'settings';

const ICONS: Record<Tab, string> = {
  today: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  progress: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6',
  log: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
};

const LABELS: Record<Tab, string> = { today: 'Today', progress: 'Progress', log: 'Log', settings: 'Settings' };

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {(Object.keys(LABELS) as Tab[]).map((t) => (
        <button key={t} aria-current={tab === t ? 'page' : undefined} onClick={() => onChange(t)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={ICONS[t]} />
          </svg>
          {LABELS[t]}
        </button>
      ))}
    </nav>
  );
}

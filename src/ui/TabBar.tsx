import { Icon, type IconName } from './Icon';

export type Tab = 'today' | 'stats' | 'logs';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'stats', label: 'Statistics', icon: 'stats' },
  { id: 'logs', label: 'Logs', icon: 'logs' },
];

export function TabBar({ tab, onChange }: { tab: Tab | null; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? 'page' : undefined} onClick={() => onChange(t.id)}>
            <Icon name={t.icon} size={25} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

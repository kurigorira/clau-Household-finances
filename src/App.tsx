import { useState } from 'react';
import Entry from './pages/Entry';
import Dashboard from './pages/Dashboard';
import AnnualTable from './pages/AnnualTable';
import Cards from './pages/Cards';
import Forecast from './pages/Forecast';
import Import from './pages/Import';
import Settings from './pages/Settings';

const tabs = [
  { id: 'entry', label: '記帳', icon: '✏️' },
  { id: 'dashboard', label: '収支', icon: '📊' },
  { id: 'annual', label: '年度表', icon: '📅' },
  { id: 'cards', label: 'カード', icon: '💳' },
  { id: 'forecast', label: '予測', icon: '📈' },
  { id: 'import', label: '取込', icon: '📥' },
  { id: 'settings', label: '設定', icon: '⚙️' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<TabId>('entry');

  return (
    <div className="app">
      <header className="app-header">
        <h1>栗原家 家計簿</h1>
      </header>
      <main className="app-main">
        {tab === 'entry' && <Entry />}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'annual' && <AnnualTable />}
        {tab === 'cards' && <Cards />}
        {tab === 'forecast' && <Forecast />}
        {tab === 'import' && <Import />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="tab-bar">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

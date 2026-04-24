import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <NavLink to="/" className="sidebar-logo" title="LecRecAll">
          <span className="logo-icon">⚡</span>
        </NavLink>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end title="Home" className={({isActive}) => isActive ? 'active' : ''}>
          <span className="icon">🏠</span>
        </NavLink>
        <NavLink to="/graph" title="Knowledge Graph" className={({isActive}) => isActive ? 'active' : ''}>
          <span className="icon">✨</span>
        </NavLink>
        <NavLink to="/chat" title="Chat" className={({isActive}) => isActive ? 'active' : ''}>
          <span className="icon">💬</span>
        </NavLink>
        <NavLink to="/review" title="Review" className={({isActive}) => isActive ? 'active' : ''}>
          <span className="icon">🎓</span>
        </NavLink>
      </nav>

      {/* Bottom static icons matching Recall */}
      <div style={{ marginTop: 'auto', paddingBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        <button title="Export" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>⬇️</button>
        <button title="Theme" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>🌙</button>
        <button title="Settings" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>⚙️</button>
      </div>
    </aside>
  );
}

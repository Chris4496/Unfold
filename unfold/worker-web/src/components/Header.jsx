import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: '⌂' },
  { to: '/queue', label: 'Case queue', icon: '▤' },
  { to: '/cases', label: 'My cases', icon: '♧' },
  { to: '/profile', label: 'Profile', icon: '●' },
];

function links(className) {
  return navigation.map((item) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/dashboard'}
      className={({ isActive }) => `${className}-link${isActive ? ' active' : ''}`}
    >
      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  ));
}

export default function Header() {
  const { worker } = useAuth();
  if (!worker) return null;

  return (
    <>
      <aside className="sidebar" aria-label="Worker workspace">
        <NavLink to="/dashboard" className="brand" aria-label="Unfold dashboard">
          <span className="brand-mark" aria-hidden="true">◒</span> Unfold
        </NavLink>
        <nav className="sidebar-nav" aria-label="Main navigation">{links('nav')}</nav>
        <div className="sidebar-worker">
          <span className="worker-avatar" aria-hidden="true">{worker.name?.trim()?.[0]?.toLocaleUpperCase() || 'W'}</span>
          <span className="worker-details"><strong>{worker.name}</strong><span>{worker.verified ? 'Verified worker' : 'Unverified worker'}</span></span>
          {!worker.verified && <span className="badge badge-amber">unverified</span>}
        </div>
      </aside>
      <header className="mobile-header">
        <NavLink to="/dashboard" className="brand" aria-label="Unfold dashboard"><span className="brand-mark" aria-hidden="true">◒</span> Unfold</NavLink>
        <span className="mobile-worker-name">{worker.name}</span>
      </header>
      <nav className="mobile-nav" aria-label="Main navigation">{links('mobile-nav')}</nav>
    </>
  );
}

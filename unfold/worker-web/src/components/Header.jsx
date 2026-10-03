import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Header() {
  const { worker } = useAuth();
  return (
    <header className="header">
      <div className="header-inner">
        <span className="brand">
          Unfold <span className="brand-sub">Social Worker Console</span>
        </span>
        <nav className="nav">
          <NavLink to="/queue" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Queue
          </NavLink>
          <NavLink to="/cases" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            My Cases
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            Profile
          </NavLink>
        </nav>
        <span className="worker-name" title={worker.email}>
          {worker.name}
          {!worker.verified && <span className="badge badge-amber">unverified</span>}
        </span>
      </div>
    </header>
  );
}

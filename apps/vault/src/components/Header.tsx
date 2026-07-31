import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { fmt, TOTAL } from '../lib';
import { initials, useAppState } from '../state';

const NAV = [
  { path: '/', label: 'Home' },
  { path: '/categories', label: 'Categories' },
  { path: '/library', label: 'Library' },
  { path: '/builder', label: 'Routines' },
  { path: '/progress', label: 'History' },
];

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { profile } = useAppState();

  const query = location.pathname === '/library' ? (params.get('q') ?? '') : '';

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button className="brand" onClick={() => navigate('/')} style={{ marginRight: 6 }}>
          <span className="brand-mark">
            <span />
          </span>
          <span className="brand-name">Vault</span>
        </button>
        <nav className="site-nav">
          {NAV.map((n) => (
            <button
              key={n.path}
              className={`nav-link${location.pathname === n.path ? ' active' : ''}`}
              onClick={() => navigate(n.path)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            className="input header-search"
            value={query}
            onChange={(e) => {
              const q = e.target.value;
              navigate(q ? `/library?q=${encodeURIComponent(q)}` : '/library', {
                replace: location.pathname === '/library',
              });
            }}
            placeholder={`Search ${fmt(TOTAL)} exercises`}
            style={{ width: 240 }}
          />
          <button
            className="btn btn-icon"
            onClick={() => navigate('/settings')}
            style={{ border: '1px solid var(--color-divider)', borderRadius: '50%', fontSize: 12, letterSpacing: '0.04em' }}
            aria-label="Profile & settings"
          >
            {initials(profile.name)}
          </button>
        </div>
      </div>
    </header>
  );
}

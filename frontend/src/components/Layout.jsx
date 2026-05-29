import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, isPremium } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div>
      <header style={{
        background: 'white',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div className="container" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <Link to="/" className="site-logo">
            <img src="/logo.png" alt="" width={28} height={28} />
            YourPet
          </Link>

          <nav style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/">Питомцы</Link>
            <Link to="/invites">Приглашения</Link>
            <Link to="/subscription">Подписка</Link>
            <span style={{ color: 'var(--muted)' }}>{user?.name}</span>
            <span className={`badge ${isPremium ? 'badge-premium' : 'badge-free'}`}>
              {isPremium ? 'Premium' : 'Free'}
            </span>
            <button className="btn btn-secondary" onClick={handleLogout}>Выйти</button>
          </nav>
        </div>
      </header>

      <main className="container" style={{ padding: '32px 0 64px' }}>
        <Outlet />
      </main>
    </div>
  );
}

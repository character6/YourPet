import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function InviteAcceptPage() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    api.getInvitePreview(token)
      .then(setPreview)
      .catch((err) => setError(err.message));
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    setError('');
    try {
      const data = await api.acceptInvite(token);
      setMessage(`Вы присоединились к «${data.petName}»`);
      setTimeout(() => navigate(data.petsAdded > 1 ? '/' : `/pets/${data.petId}`), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ paddingTop: 80 }}>Загрузка...</div>;
  }

  if (!user) {
    return (
      <div className="container" style={{ maxWidth: 480, paddingTop: 80 }}>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>Приглашение в семью</h1>
          {preview && (
            <p style={{ color: 'var(--muted)' }}>
              {preview.inviterName} приглашает вас к питомцу <strong>{preview.petName}</strong>
            </p>
          )}
          <p>Войдите или зарегистрируйтесь, чтобы принять приглашение.</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link className="btn btn-primary" to={`/login?redirect=/invite/${token}`}>Войти</Link>
            <Link className="btn btn-secondary" to={`/register?redirect=/invite/${token}`}>Регистрация</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 80 }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Приглашение в семью</h1>

        {preview && (
          <p style={{ color: 'var(--muted)' }}>
            {preview.inviterName} приглашает вас к питомцу <strong>{preview.petName}</strong>
          </p>
        )}

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {!message && (
          <button type="button" className="btn btn-primary" onClick={accept} disabled={accepting || !preview}>
            {accepting ? 'Присоединение...' : 'Принять приглашение'}
          </button>
        )}

        <p style={{ marginTop: 20 }}>
          <Link to="/">← На главную</Link>
        </p>
      </div>
    </div>
  );
}

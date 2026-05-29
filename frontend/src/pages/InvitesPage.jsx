import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import InviteLinkBox from '../components/InviteLinkBox';

export default function InvitesPage() {
  const { isPremium } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [referralLink, setReferralLink] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    api.getMyInvites()
      .then(({ invites }) => setInvites(invites))
      .catch((err) => setError(err.message));

    if (isPremium) {
      api.getMyReferralLink()
        .then(({ referralLink: link }) => setReferralLink(link))
        .catch(() => setReferralLink(''));
    }
  };

  useEffect(load, [isPremium]);

  const accept = async (token) => {
    try {
      const data = await api.acceptInvite(token);
      setMessage(`Вы присоединились: ${data.petName}`);
      load();
      setTimeout(() => navigate(data.petId ? `/pets/${data.petId}` : '/'), 1000);
    } catch (err) {
      setError(err.message);
    }
  };

  const regenerate = async () => {
    try {
      const data = await api.regenerateReferralLink();
      setReferralLink(data.referralLink);
      setMessage('Ссылка обновлена');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1>Приглашения</h1>
      <p style={{ color: 'var(--muted)' }}>
        Одна ссылка для доступа ко всем вашим питомцам (Premium)
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {isPremium && referralLink && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Реферальная ссылка Premium</h2>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Отправьте одну ссылку — близкие получат доступ ко всем вашим питомцам после входа в аккаунт.
          </p>
          <InviteLinkBox
            link={referralLink}
            label="Ссылка-приглашение"
            onRegenerate={regenerate}
          />
        </div>
      )}

      {isPremium && !referralLink && (
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            Оформите Premium и добавьте питомца, чтобы получить ссылку.
          </p>
        </div>
      )}

      <h2>Входящие приглашения</h2>
      {invites.length === 0 ? (
        <div className="card empty-state">
          <p>Нет активных приглашений</p>
        </div>
      ) : (
        <div className="card">
          {invites.map((invite) => (
            <div key={invite.id} className="list-item">
              <div>
                <strong>{invite.petName}</strong>
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  Пригласил(а): {invite.inviterName} · {new Date(invite.createdAt).toLocaleDateString('ru-RU')}
                </div>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => accept(invite.token)}>
                Принять
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

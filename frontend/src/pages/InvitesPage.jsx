import { useEffect, useState } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { api } from '../api/client';

import { useAuth } from '../context/AuthContext';

import InviteLinkBox from '../components/InviteLinkBox';



export default function InvitesPage() {

  const { isPremium } = useAuth();

  const navigate = useNavigate();

  const [invites, setInvites] = useState([]);

  const [referralLinks, setReferralLinks] = useState([]);

  const [error, setError] = useState('');

  const [message, setMessage] = useState('');



  const load = () => {

    api.getMyInvites()

      .then(({ invites }) => setInvites(invites))

      .catch((err) => setError(err.message));



    if (isPremium) {

      api.getMyReferralLinks()

        .then(({ links }) => setReferralLinks(links))

        .catch(() => {});

    }

  };



  useEffect(load, [isPremium]);



  const accept = async (token) => {

    try {

      const data = await api.acceptInvite(token);

      setMessage(`Вы присоединились к профилю «${data.petName}»`);

      load();

      setTimeout(() => navigate(`/pets/${data.petId}`), 1000);

    } catch (err) {

      setError(err.message);

    }

  };



  const regenerate = async (petId) => {

    try {

      await api.regenerateReferralLink(petId);

      load();

      setMessage('Ссылка обновлена');

    } catch (err) {

      setError(err.message);

    }

  };



  return (

    <div>

      <h1>Приглашения</h1>

      <p style={{ color: 'var(--muted)' }}>

        Входящие приглашения и ваши реферальные ссылки Premium

      </p>



      {error && <div className="alert alert-error">{error}</div>}

      {message && <div className="alert alert-success">{message}</div>}



      {isPremium && referralLinks.length > 0 && (

        <div className="card" style={{ marginBottom: 24 }}>

          <h2 style={{ marginTop: 0 }}>Мои реферальные ссылки</h2>

          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Поделитесь ссылкой — близкие смогут присоединиться к профилю питомца.
            На продакшене адрес будет ваш домен (настраивается в FRONTEND_URL на сервере).
          </p>

          {referralLinks.map((item) => (

            <div key={item.petId} style={{ marginBottom: 20 }}>

              <strong>{item.petName}</strong>

              <InviteLinkBox

                link={item.referralLink}

                label="Реферальная ссылка Premium"

                onRegenerate={() => regenerate(item.petId)}

              />

            </div>

          ))}

        </div>

      )}



      {isPremium && referralLinks.length === 0 && (

        <div className="card" style={{ marginBottom: 24 }}>

          <p style={{ margin: 0, color: 'var(--muted)' }}>

            Добавьте питомца, чтобы получить реферальную ссылку для семейного доступа.

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



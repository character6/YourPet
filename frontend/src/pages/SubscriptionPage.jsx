import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PaymentModal from '../components/PaymentModal';

export default function SubscriptionPage() {
  const { user, isPremium, updateUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.getPlans().then(({ plans }) => setPlans(plans));
  }, []);

  const handleCancel = async () => {
    await api.cancelSubscription();
    updateUser({ ...user, subscriptionTier: 'free', subscriptionExpiresAt: null });
    setMessage('Подписка отменена');
  };

  return (
    <div>
      <h1>Подписка</h1>
      <p style={{ color: 'var(--muted)' }}>
        Текущий план:{' '}
        <span className={`badge ${isPremium ? 'badge-premium' : 'badge-free'}`}>
          {isPremium ? 'Premium' : 'Free'}
        </span>
      </p>

      {message && <div className="alert alert-success">{message}</div>}

      <div className="grid-2" style={{ marginTop: 24 }}>
        {plans.map((plan) => (
          <div key={plan.id} className="card">
            <h2 style={{ marginTop: 0 }}>{plan.name}</h2>
            <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>
              {plan.price === 0 ? 'Бесплатно' : `${plan.price} ₽ / мес`}
            </p>
            <ul style={{ color: 'var(--muted)', paddingLeft: 18 }}>
              {plan.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            {plan.id === 'premium' && !isPremium && (
              <button className="btn btn-premium" onClick={() => setShowPayment(true)}>
                Оформить Premium
              </button>
            )}
            {plan.id === 'premium' && isPremium && (
              <button className="btn btn-secondary" onClick={handleCancel}>
                Отменить подписку
              </button>
            )}
          </div>
        ))}
      </div>

      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          onSuccess={() => setMessage('Premium успешно активирован!')}
        />
      )}
    </div>
  );
}

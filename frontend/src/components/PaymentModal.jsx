import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function PaymentModal({ onClose, onSuccess }) {
  const { updateUser } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.subscribe('premium', paymentMethod);
      updateUser(data.user);
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Оформление Premium</h2>
        <p style={{ color: 'var(--muted)' }}>
          Демо-оплата: подписка активируется сразу без реального списания.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handlePay}>
          <div className="card" style={{ background: '#faf5ff', marginBottom: 20 }}>
            <strong>Premium — 499 ₽ / месяц</strong>
            <ul style={{ paddingLeft: 18, color: 'var(--muted)' }}>
              <li>Семейный доступ до 5 человек</li>
              <li>Коллективный календарь</li>
              <li>Неограниченное число питомцев</li>
              <li>Аналитика и PDF-отчёты</li>
            </ul>
          </div>

          <div className="form-group">
            <label>Способ оплаты</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="card">Банковская карта</option>
              <option value="sbp">СБП</option>
            </select>
          </div>

          {paymentMethod === 'card' && (
            <>
              <div className="form-group">
                <label>Номер карты</label>
                <input placeholder="0000 0000 0000 0000" defaultValue="4111 1111 1111 1111" />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Срок</label>
                  <input placeholder="MM/YY" defaultValue="12/28" />
                </div>
                <div className="form-group">
                  <label>CVC</label>
                  <input placeholder="123" defaultValue="123" />
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-premium" disabled={loading}>
              {loading ? 'Обработка...' : 'Оплатить 499 ₽'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

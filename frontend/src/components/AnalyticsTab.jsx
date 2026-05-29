import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { api } from '../api/client';

async function downloadCareReport(petId, petName) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/pets/${petId}/reports/care-history`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Не удалось сформировать PDF');
  }
  const buffer = await res.arrayBuffer();
  const header = new TextDecoder().decode(new Uint8Array(buffer).slice(0, 5));
  if (!header.startsWith('%PDF')) {
    throw new Error('Сервер вернул некорректный файл. Проверьте, что backend запущен.');
  }
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = petName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'pet';
  a.download = `yourpet-${safeName}-report.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsTab({ petId, petName }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [weightForm, setWeightForm] = useState({ weight: '', recordedAt: '', note: '' });
  const [exporting, setExporting] = useState(false);

  const load = () => {
    api.getAnalytics(petId)
      .then(setData)
      .catch((err) => setError(err.message));
  };

  useEffect(load, [petId]);

  const handleWeight = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.addWeightRecord(petId, {
        weight: Number(weightForm.weight),
        recordedAt: weightForm.recordedAt || undefined,
        note: weightForm.note || undefined,
      });
      setWeightForm({ weight: '', recordedAt: '', note: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      await downloadCareReport(petId, petName);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (!data) {
    return <p>{error || 'Загрузка аналитики...'}</p>;
  }

  const weightChart = data.weightHistory.map((r) => ({
    date: new Date(r.recordedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    weight: r.weight,
  }));

  const activityChart = data.activityByWeek.map((w) => ({
    week: new Date(w.weekStart).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    Выгулы: w.walks,
    Кормления: w.feedings,
    Лекарства: w.medicine,
  }));

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Экспорт для ветеринара</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
              PDF с дневником, весом, напоминаниями и историей ухода
            </p>
          </div>
          <button type="button" className="btn btn-premium" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Формирование...' : 'Скачать PDF-отчёт'}
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Динамика веса</h2>
          {weightChart.length === 0 ? (
            <p className="empty-state">Добавьте первую запись веса</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={weightChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis unit=" кг" fontSize={12} domain={['auto', 'auto']} />
                <Tooltip formatter={(v) => [`${v} кг`, 'Вес']} />
                <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          <form onSubmit={handleWeight} style={{ marginTop: 20 }}>
            <div className="form-group">
              <label>Новый замер (кг)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={weightForm.weight}
                onChange={(e) => setWeightForm({ ...weightForm, weight: e.target.value })}
                required
              />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Дата</label>
                <input
                  type="date"
                  value={weightForm.recordedAt}
                  onChange={(e) => setWeightForm({ ...weightForm, recordedAt: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Примечание</label>
                <input
                  value={weightForm.note}
                  onChange={(e) => setWeightForm({ ...weightForm, note: e.target.value })}
                  placeholder="После приёма пищи"
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Добавить замер</button>
          </form>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Активность (календарь)</h2>
          <p style={{ color: 'var(--muted)', marginTop: 0, fontSize: '0.9rem' }}>
            Выполненные задачи за последние 12 недель
          </p>
          {activityChart.length === 0 ? (
            <p className="empty-state">Отмечайте задачи в календаре — здесь появится статистика</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={activityChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" fontSize={11} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Выгулы" fill="#059669" />
                <Bar dataKey="Кормления" fill="#2563eb" />
                <Bar dataKey="Лекарства" fill="#ea580c" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

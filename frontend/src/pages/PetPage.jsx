import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PaymentModal from '../components/PaymentModal';
import PetAvatar from '../components/PetAvatar';
import AnalyticsTab from '../components/AnalyticsTab';
import { AVATAR_COLORS } from '../components/PetAvatar';

const ENTRY_TYPES = {
  symptom: 'Симптом',
  visit: 'Визит к врачу',
  note: 'Заметка',
};

const REMINDER_TYPES = {
  vaccination: 'Прививка',
  parasite: 'Обработка от паразитов',
  other: 'Другое',
};

const TASK_TYPES = {
  feeding: 'Кормление',
  walk: 'Выгул',
  medicine: 'Лекарство',
  other: 'Другое',
};

const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'Один раз' },
  { value: 'every_4h', label: 'Каждые 4 ч' },
  { value: 'every_6h', label: 'Каждые 6 ч' },
  { value: 'every_12h', label: 'Каждые 12 ч' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Раз в неделю' },
  { value: 'monthly', label: 'Раз в месяц' },
];

async function downloadFile(petId, docId, filename) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api/pets/${petId}/documents/${docId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Не удалось скачать файл');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PetPage() {
  const { petId } = useParams();
  const [tab, setTab] = useState('diary');
  const [pet, setPet] = useState(null);
  const [entries, setEntries] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [showPayment, setShowPayment] = useState(false);

  const [diaryForm, setDiaryForm] = useState({ entryType: 'note', title: '', content: '', entryDate: '' });
  const [reminderForm, setReminderForm] = useState({ title: '', reminderType: 'vaccination', dueDate: '' });
  const [taskForm, setTaskForm] = useState({
    title: '',
    taskType: 'feeding',
    scheduledAt: '',
    recurrence: 'once',
  });

  const loadAll = async () => {
    try {
      const petData = await api.getPet(petId);
      setPet(petData.pet);
      const premiumAccess = petData.pet.hasPremiumFeatures;
      const [diary, rems, docs] = await Promise.all([
        api.getDiary(petId),
        api.getReminders(petId),
        api.getDocuments(petId),
      ]);
      setEntries(diary.entries);
      setReminders(rems.reminders);
      setDocuments(docs.documents);

      if (premiumAccess) {
        const cal = await api.getCalendarTasks(petId).catch(() => ({ tasks: [] }));
        setTasks(cal.tasks);
      } else {
        setTasks([]);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadAll();
  }, [petId]);

  const handleDiary = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createDiaryEntry(petId, diaryForm);
      setDiaryForm({ entryType: 'note', title: '', content: '', entryDate: '' });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReminder = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createReminder(petId, reminderForm);
      setReminderForm({ title: '', reminderType: 'vaccination', dueDate: '' });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      await api.uploadDocument(petId, file);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      await api.uploadPetPhoto(petId, file);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAvatarColor = async (color) => {
    setError('');
    try {
      await api.updatePet(petId, { avatarColor: color });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTask = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createCalendarTask(petId, {
        ...taskForm,
        scheduledAt: new Date(taskForm.scheduledAt).toISOString(),
      });
      setTaskForm({ title: '', taskType: 'feeding', scheduledAt: '', recurrence: 'once' });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!pet && !error) {
    return (
      <div>
        <Link to="/">← Назад</Link>
        <p style={{ marginTop: 24 }}>Загрузка...</p>
      </div>
    );
  }

  if (!pet) {
    return (
      <div>
        <Link to="/">← Назад</Link>
        <div className="alert alert-error" style={{ marginTop: 24 }}>{error}</div>
      </div>
    );
  }

  const premiumAccess = pet.hasPremiumFeatures;

  const tabs = [
    { id: 'profile', label: 'Профиль' },
    { id: 'diary', label: 'Дневник' },
    { id: 'reminders', label: 'Напоминания' },
    { id: 'documents', label: 'Документы' },
    ...(premiumAccess ? [
      { id: 'calendar', label: 'Календарь' },
      { id: 'analytics', label: 'Аналитика' },
    ] : []),
  ];

  return (
    <div>
      <Link to="/" style={{ color: 'var(--muted)' }}>← Все питомцы</Link>

      <div className="card pet-header" style={{ marginTop: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <PetAvatar pet={pet} size={88} />
          <div>
            <h1 style={{ margin: '0 0 8px' }}>{pet.name}</h1>
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
              {pet.age != null && ` · ${pet.age} лет`}
              {pet.weight != null && ` · ${pet.weight} кг`}
            </p>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Фото и аватарка</h2>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
            <PetAvatar pet={pet} size={120} />
            <div>
              <label className="btn btn-primary" style={{ marginRight: 8 }}>
                Загрузить фото
                <input type="file" hidden accept="image/*" onChange={handlePhotoUpload} />
              </label>
              {pet.hasPhoto && (
                <button type="button" className="btn btn-danger" onClick={() => api.deletePetPhoto(petId).then(loadAll)}>
                  Удалить фото
                </button>
              )}
            </div>
          </div>

          <h3>Цвет аватарки</h3>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>Используется, если фото не загружено</p>
          <div className="color-picker">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch ${pet.avatarColor === color ? 'active' : ''}`}
                style={{ background: color }}
                onClick={() => handleAvatarColor(color)}
                aria-label={`Цвет ${color}`}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'diary' && (
        <div className="grid-2">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Новая запись</h2>
            <form onSubmit={handleDiary}>
              <div className="form-group">
                <label>Тип</label>
                <select value={diaryForm.entryType} onChange={(e) => setDiaryForm({ ...diaryForm, entryType: e.target.value })}>
                  {Object.entries(ENTRY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Заголовок</label>
                <input value={diaryForm.title} onChange={(e) => setDiaryForm({ ...diaryForm, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Дата</label>
                <input type="date" value={diaryForm.entryDate} onChange={(e) => setDiaryForm({ ...diaryForm, entryDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Описание</label>
                <textarea value={diaryForm.content} onChange={(e) => setDiaryForm({ ...diaryForm, content: e.target.value })} />
              </div>
              <button className="btn btn-primary" type="submit">Добавить</button>
            </form>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Записи</h2>
            {entries.length === 0 ? <p className="empty-state">Записей пока нет</p> : entries.map((entry) => (
              <div key={entry.id} className="list-item">
                <div>
                  <strong>{entry.title}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {ENTRY_TYPES[entry.entryType]} · {entry.entryDate} · {entry.userName}
                  </div>
                  {entry.content && <p>{entry.content}</p>}
                </div>
                <button type="button" className="btn btn-danger" onClick={() => api.deleteDiaryEntry(petId, entry.id).then(loadAll)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'reminders' && (
        <div className="grid-2">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Напоминание</h2>
            <form onSubmit={handleReminder}>
              <div className="form-group">
                <label>Заголовок</label>
                <input value={reminderForm.title} onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Тип</label>
                <select value={reminderForm.reminderType} onChange={(e) => setReminderForm({ ...reminderForm, reminderType: e.target.value })}>
                  {Object.entries(REMINDER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Дата</label>
                <input type="date" value={reminderForm.dueDate} onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })} required />
              </div>
              <button className="btn btn-primary" type="submit">Создать</button>
            </form>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Список</h2>
            {reminders.map((r) => (
              <div key={r.id} className="list-item">
                <div>
                  <strong style={{ textDecoration: r.isDone ? 'line-through' : 'none' }}>{r.title}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {REMINDER_TYPES[r.reminderType]} · {r.dueDate}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => api.toggleReminder(petId, r.id, !r.isDone).then(loadAll)}
                >
                  {r.isDone ? 'Вернуть' : 'Готово'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0 }}>Документы</h2>
            <label className="btn btn-primary">
              Загрузить
              <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={handleUpload} />
            </label>
          </div>
          {documents.length === 0 ? (
            <p className="empty-state">Загрузите ветпаспорт или другие документы</p>
          ) : documents.map((doc) => (
            <div key={doc.id} className="list-item">
              <div>
                <strong>{doc.originalName}</strong>
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  {(doc.size / 1024).toFixed(1)} KB · {new Date(doc.uploadedAt).toLocaleDateString('ru-RU')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => downloadFile(petId, doc.id, doc.originalName)}>
                  Скачать
                </button>
                <button type="button" className="btn btn-danger" onClick={() => api.deleteDocument(petId, doc.id).then(loadAll)}>Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'calendar' && premiumAccess && (
        <div className="grid-2">
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Новая задача</h2>
            <form onSubmit={handleTask}>
              <div className="form-group">
                <label>Задача</label>
                <input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Тип</label>
                <select value={taskForm.taskType} onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value })}>
                  {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Дата и время</label>
                <input type="datetime-local" value={taskForm.scheduledAt} onChange={(e) => setTaskForm({ ...taskForm, scheduledAt: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Периодичность</label>
                <div className="recurrence-chips">
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`recurrence-chip ${taskForm.recurrence === opt.value ? 'active' : ''}`}
                      onClick={() => setTaskForm({ ...taskForm, recurrence: opt.value })}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn-primary" type="submit">Добавить</button>
            </form>
          </div>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Коллективный календарь</h2>
            {tasks.length === 0 ? (
              <p className="empty-state">Задач пока нет</p>
            ) : tasks.map((task) => (
              <div key={task.id} className="list-item">
                <div>
                  <strong>{task.title}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {TASK_TYPES[task.taskType]} · {new Date(task.scheduledAt).toLocaleString('ru-RU')}
                  </div>
                  {task.recurrence && task.recurrence !== 'once' && (
                    <span className="badge badge-free">{task.recurrenceLabel || task.recurrence}</span>
                  )}
                  {task.completedAt && (
                    <div style={{ color: 'var(--success)', fontSize: '0.85rem' }}>
                      Выполнил(а) {task.completedByName} · {new Date(task.completedAt).toLocaleString('ru-RU')}
                    </div>
                  )}
                </div>
                {!task.completedAt && (
                  <button type="button" className="btn btn-primary" onClick={() => api.completeCalendarTask(petId, task.id).then(loadAll)}>
                    Выполнено
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'analytics' && premiumAccess && (
        <AnalyticsTab petId={petId} petName={pet.name} />
      )}

      {showPayment && <PaymentModal onClose={() => setShowPayment(false)} onSuccess={loadAll} />}
    </div>
  );
}

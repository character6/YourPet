import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PetAvatar from '../components/PetAvatar';
import SpeciesSelect, { resolveSpecies } from '../components/SpeciesSelect';
import { AVATAR_COLORS } from '../components/PetAvatar';

export default function DashboardPage() {
  const { isPremium } = useAuth();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [form, setForm] = useState({
    name: '',
    species: '',
    customSpecies: '',
    breed: '',
    age: '',
    weight: '',
    avatarColor: AVATAR_COLORS[0],
  });

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const loadPets = () => {
    api.getPets()
      .then(({ pets }) => setPets(pets))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadPets, []);

  const resetForm = () => {
    setForm({
      name: '',
      species: '',
      customSpecies: '',
      breed: '',
      age: '',
      weight: '',
      avatarColor: AVATAR_COLORS[0],
    });
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    const species = resolveSpecies(form.species, form.customSpecies);
    if (!species) {
      setError('Укажите вид питомца');
      return;
    }
    try {
      const { pet } = await api.createPet({
        name: form.name,
        species,
        breed: form.breed || undefined,
        age: form.age ? Number(form.age) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
        avatarColor: form.avatarColor,
      });

      if (photoFile) {
        await api.uploadPetPhoto(pet.id, photoFile);
      }

      resetForm();
      setShowForm(false);
      loadPets();
    } catch (err) {
      setError(err.message);
    }
  };

  const canAddPet = isPremium || pets.filter((p) => p.role === 'owner').length < 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Мои питомцы</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
            {isPremium ? 'Premium: неограниченное число профилей' : 'Free: доступен 1 питомец'}
          </p>
        </div>
        {canAddPet && (
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Отмена' : '+ Добавить питомца'}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ marginTop: 0 }}>Новый питомец</h2>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Фото / аватарка</label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Превью"
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid var(--border)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: form.avatarColor,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.75rem',
                    }}
                  >
                    {form.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <label className="btn btn-secondary">
                  Загрузить фото
                  <input type="file" hidden accept="image/*" onChange={handlePhotoSelect} />
                </label>
                {photoFile && (
                  <button type="button" className="btn btn-danger" onClick={() => { setPhotoFile(null); if (photoPreview) URL.revokeObjectURL(photoPreview); setPhotoPreview(null); }}>
                    Убрать фото
                  </button>
                )}
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Кличка</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <SpeciesSelect
                species={form.species}
                customSpecies={form.customSpecies}
                onSpeciesChange={(value) => setForm({ ...form, species: value })}
                onCustomChange={(value) => setForm({ ...form, customSpecies: value })}
              />
              <div className="form-group">
                <label>Порода</label>
                <input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Возраст (лет)</label>
                <input type="number" min="0" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Вес (кг)</label>
                <input type="number" step="0.1" min="0" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
              </div>
              {!photoFile && (
                <div className="form-group">
                  <label>Цвет аватарки</label>
                  <div className="color-picker">
                    {AVATAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-swatch ${form.avatarColor === color ? 'active' : ''}`}
                        style={{ background: color }}
                        onClick={() => setForm({ ...form, avatarColor: color })}
                        aria-label={`Цвет ${color}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="btn btn-primary" type="submit">Сохранить</button>
          </form>
        </div>
      )}

      {loading ? (
        <p>Загрузка...</p>
      ) : pets.length === 0 ? (
        <div className="card empty-state">
          <h2>Пока нет питомцев</h2>
          <p>Добавьте первого питомца, чтобы вести дневник здоровья</p>
        </div>
      ) : (
        <div className="grid-2">
          {pets.map((pet) => (
            <Link key={pet.id} to={`/pets/${pet.id}`} className="card pet-card">
              <div style={{ display: 'flex', gap: 16, alignItems: 'start' }}>
                <PetAvatar pet={pet} size={64} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <h2 style={{ margin: '0 0 8px' }}>{pet.name}</h2>
                    {pet.role === 'member' && (
                      <span className="badge badge-free">Семья</span>
                    )}
                  </div>
                  <p style={{ margin: 0, color: 'var(--muted)' }}>
                    {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
                  </p>
                  <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>
                    {pet.age != null && `Возраст: ${pet.age} лет`}
                    {pet.weight != null && ` · Вес: ${pet.weight} кг`}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

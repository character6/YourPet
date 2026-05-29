export default function SpeciesSelect({ species, customSpecies, onSpeciesChange, onCustomChange, required = true }) {
  const isOther = species === 'Другое';

  return (
    <>
      <div className="form-group">
        <label>Вид</label>
        <select
          value={species}
          onChange={(e) => onSpeciesChange(e.target.value)}
          required={required && !isOther}
        >
          <option value="">Выберите</option>
          <option value="Собака">Собака</option>
          <option value="Кошка">Кошка</option>
          <option value="Птица">Птица</option>
          <option value="Грызун">Грызун</option>
          <option value="Другое">Другое</option>
        </select>
      </div>
      {isOther && (
        <div className="form-group">
          <label>Укажите вид</label>
          <input
            value={customSpecies}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder="Например: Черепаха, Кролик..."
            required
          />
        </div>
      )}
    </>
  );
}

export function resolveSpecies(species, customSpecies) {
  if (species === 'Другое') {
    return customSpecies.trim();
  }
  return species;
}

export function speciesToFormValue(species) {
  const presets = ['Собака', 'Кошка', 'Птица', 'Грызун'];
  if (presets.includes(species)) {
    return { species, customSpecies: '' };
  }
  return { species: 'Другое', customSpecies: species };
}

class PetProfile {
  const PetProfile({
    required this.species,
    required this.breed,
    required this.birthDate,
    required this.weightKg,
    this.photoPath,
  });

  final String species;
  final String breed;
  final DateTime birthDate;
  final double weightKg;
  final String? photoPath;

  PetProfile copyWith({
    String? species,
    String? breed,
    DateTime? birthDate,
    double? weightKg,
    String? photoPath,
    bool clearPhoto = false,
  }) {
    return PetProfile(
      species: species ?? this.species,
      breed: breed ?? this.breed,
      birthDate: birthDate ?? this.birthDate,
      weightKg: weightKg ?? this.weightKg,
      photoPath: clearPhoto ? null : (photoPath ?? this.photoPath),
    );
  }

  Map<String, Object?> toMap() => {
        'id': 1,
        'species': species,
        'breed': breed,
        'birth_date_ms': birthDate.millisecondsSinceEpoch,
        'weight_kg': weightKg,
        'photo_path': photoPath,
      };

  static PetProfile? fromMap(Map<String, Object?>? m) {
    if (m == null) return null;
    final species = m['species'] as String?;
    final breed = m['breed'] as String?;
    final birth = m['birth_date_ms'] as int?;
    final weight = m['weight_kg'] as num?;
    if (species == null || breed == null || birth == null || weight == null) return null;
    return PetProfile(
      species: species,
      breed: breed,
      birthDate: DateTime.fromMillisecondsSinceEpoch(birth),
      weightKg: weight.toDouble(),
      photoPath: m['photo_path'] as String?,
    );
  }
}

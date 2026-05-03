enum ReminderRepeat {
  once,
  daily,
  weekly,
  byDate;

  String get label {
    return switch (this) {
      ReminderRepeat.once => 'Один раз',
      ReminderRepeat.daily => 'Ежедневно',
      ReminderRepeat.weekly => 'Еженедельно',
      ReminderRepeat.byDate => 'По дате',
    };
  }

  static ReminderRepeat fromDb(String v) {
    return ReminderRepeat.values.firstWhere(
      (e) => e.name == v,
      orElse: () => ReminderRepeat.once,
    );
  }
}

class Reminder {
  Reminder({
    required this.id,
    required this.title,
    required this.scheduledAt,
    required this.repeat,
    required this.nextFireAt,
    required this.enabled,
  });

  final int id;
  final String title;
  final DateTime scheduledAt;
  final ReminderRepeat repeat;
  final DateTime nextFireAt;
  final bool enabled;

  Map<String, Object?> toMap() => {
        'id': id,
        'title': title,
        'scheduled_at_ms': scheduledAt.millisecondsSinceEpoch,
        'repeat': repeat.name,
        'next_fire_at_ms': nextFireAt.millisecondsSinceEpoch,
        'enabled': enabled ? 1 : 0,
      };

  static Reminder fromMap(Map<String, Object?> m) {
    return Reminder(
      id: m['id'] as int,
      title: m['title'] as String,
      scheduledAt: DateTime.fromMillisecondsSinceEpoch(m['scheduled_at_ms'] as int),
      repeat: ReminderRepeat.fromDb(m['repeat'] as String),
      nextFireAt: DateTime.fromMillisecondsSinceEpoch(m['next_fire_at_ms'] as int),
      enabled: (m['enabled'] as int) == 1,
    );
  }

  Reminder copyWith({
    int? id,
    String? title,
    DateTime? scheduledAt,
    ReminderRepeat? repeat,
    DateTime? nextFireAt,
    bool? enabled,
  }) {
    return Reminder(
      id: id ?? this.id,
      title: title ?? this.title,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      repeat: repeat ?? this.repeat,
      nextFireAt: nextFireAt ?? this.nextFireAt,
      enabled: enabled ?? this.enabled,
    );
  }
}

enum DiaryEntryType {
  symptom,
  visit,
  note;

  String get label {
    return switch (this) {
      DiaryEntryType.symptom => 'Симптом',
      DiaryEntryType.visit => 'Визит',
      DiaryEntryType.note => 'Заметка',
    };
  }

  static DiaryEntryType fromDb(String v) {
    return DiaryEntryType.values.firstWhere(
      (e) => e.name == v,
      orElse: () => DiaryEntryType.note,
    );
  }
}

class DiaryEntry {
  DiaryEntry({
    required this.id,
    required this.date,
    required this.type,
    required this.text,
    required this.status,
    required this.attachmentPaths,
  });

  final int id;
  final DateTime date;
  final DiaryEntryType type;
  final String text;
  final String status;
  final List<String> attachmentPaths;

  Map<String, Object?> toMap() => {
        'id': id,
        'date_ms': date.millisecondsSinceEpoch,
        'type': type.name,
        'text': text,
        'status': status,
        'attachment_paths': attachmentPaths.join('|'),
      };

  static DiaryEntry fromMap(Map<String, Object?> m) {
    final pathsRaw = m['attachment_paths'] as String? ?? '';
    return DiaryEntry(
      id: m['id'] as int,
      date: DateTime.fromMillisecondsSinceEpoch(m['date_ms'] as int),
      type: DiaryEntryType.fromDb(m['type'] as String),
      text: m['text'] as String,
      status: m['status'] as String,
      attachmentPaths: pathsRaw.isEmpty ? [] : pathsRaw.split('|'),
    );
  }
}

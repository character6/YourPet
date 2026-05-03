class SavedDocument {
  SavedDocument({
    required this.id,
    required this.fileName,
    required this.mime,
    required this.localPath,
    required this.addedAt,
  });

  final int id;
  final String fileName;
  final String mime;
  final String localPath;
  final DateTime addedAt;

  static SavedDocument fromMap(Map<String, Object?> m) {
    return SavedDocument(
      id: m['id'] as int,
      fileName: m['file_name'] as String,
      mime: m['mime'] as String,
      localPath: m['local_path'] as String,
      addedAt: DateTime.fromMillisecondsSinceEpoch(m['added_ms'] as int),
    );
  }
}

/// Веб: нет dart:io. Каталоги приложения на web ограничены; копирование с диска не используется.
Future<void> ensureDir(String path) async {}

Future<void> deleteDirRecursive(String path) async {}

Future<void> deleteFileIfExists(String path) async {}

Future<void> copyFile(String from, String to) async {}

bool fileExistsSync(String path) => false;

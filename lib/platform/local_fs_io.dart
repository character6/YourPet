import 'dart:io';

import 'package:path/path.dart' as p;

Future<void> ensureDir(String path) async {
  final d = Directory(path);
  if (!await d.exists()) await d.create(recursive: true);
}

Future<void> deleteDirRecursive(String path) async {
  final d = Directory(path);
  if (await d.exists()) await d.delete(recursive: true);
}

Future<void> deleteFileIfExists(String path) async {
  final f = File(path);
  if (await f.exists()) await f.delete();
}

Future<void> copyFile(String from, String to) async {
  await ensureDir(p.dirname(to));
  await File(from).copy(to);
}

bool fileExistsSync(String path) => File(path).existsSync();

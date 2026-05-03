import 'dart:io';

import 'package:archive/archive_io.dart';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:sqflite/sqflite.dart';

import '../data/petcare_database.dart';

Future<void> runPetCareExport(BuildContext context) async {
  final dbPath = p.join(await getDatabasesPath(), 'petcare.db');
  final rootPath = await PetcareDatabase.appStorageRootPath();
  final tmp = await getTemporaryDirectory();
  final out = p.join(
    tmp.path,
    'petcare_export_${DateTime.now().millisecondsSinceEpoch}.zip',
  );
  final enc = ZipFileEncoder()..create(out);
  if (await File(dbPath).exists()) {
    enc.addFile(File(dbPath), 'petcare.db');
  }
  Future<void> addDir(String name) async {
    final dir = Directory(p.join(rootPath, name));
    if (!await dir.exists()) return;
    await for (final e in dir.list(recursive: true)) {
      if (e is File) {
        final rel = p.relative(e.path, from: rootPath).replaceAll('\\', '/');
        enc.addFile(File(e.path), rel);
      }
    }
  }

  await addDir('attachments');
  await addDir('documents');
  final photo = File(p.join(rootPath, 'pet_photo.jpg'));
  if (await photo.exists()) enc.addFile(photo, 'pet_photo.jpg');
  enc.close();
  if (!context.mounted) return;
  await Share.shareXFiles([XFile(out)], text: 'Экспорт Pet Care');
}

import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

import '../models/diary_entry.dart';
import '../models/pet_profile.dart';
import '../models/reminder.dart';
import '../models/saved_document.dart';
import '../platform/local_fs.dart' as local_fs;

const _dbName = 'petcare.db';

class PetcareDatabase {
  PetcareDatabase._();
  static final PetcareDatabase instance = PetcareDatabase._();

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _open();
    return _db!;
  }

  Future<void> init() async {
    await database;
    await ensureStorageDirs();
  }

  static Future<String> appStorageRootPath() async {
    if (kIsWeb) {
      const rootPath = 'petcare';
      await local_fs.ensureDir(rootPath);
      return rootPath;
    }
    final base = await getApplicationDocumentsDirectory();
    final rootPath = p.join(base.path, 'petcare');
    await local_fs.ensureDir(rootPath);
    return rootPath;
  }

  Future<void> ensureStorageDirs() async {
    final rootPath = await appStorageRootPath();
    for (final sub in ['attachments', 'documents', 'export']) {
      await local_fs.ensureDir(p.join(rootPath, sub));
    }
  }

  Future<Database> _open() async {
    final dir = await getDatabasesPath();
    return openDatabase(
      p.join(dir, _dbName),
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE pet (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            species TEXT NOT NULL,
            breed TEXT NOT NULL,
            birth_date_ms INTEGER NOT NULL,
            weight_kg REAL NOT NULL,
            photo_path TEXT
          );
        ''');
        await db.execute('''
          CREATE TABLE diary_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date_ms INTEGER NOT NULL,
            type TEXT NOT NULL,
            text TEXT NOT NULL,
            status TEXT NOT NULL,
            attachment_paths TEXT NOT NULL DEFAULT ''
          );
        ''');
        await db.execute('''
          CREATE TABLE reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            scheduled_at_ms INTEGER NOT NULL,
            repeat TEXT NOT NULL,
            next_fire_at_ms INTEGER NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1
          );
        ''');
        await db.execute('''
          CREATE TABLE documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_name TEXT NOT NULL,
            mime TEXT NOT NULL,
            local_path TEXT NOT NULL,
            added_ms INTEGER NOT NULL
          );
        ''');
        await db.execute('''
          CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        ''');
        await db.insert('settings', {'key': 'theme', 'value': 'system'});
      },
    );
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }

  Future<void> wipeAll() async {
    await close();
    final dbPath = p.join(await getDatabasesPath(), _dbName);
    await local_fs.deleteFileIfExists(dbPath);
    final rootPath = await appStorageRootPath();
    await local_fs.deleteDirRecursive(rootPath);
    await init();
  }

  /// Удаляет пользовательский контент, настройки (тема) сохраняются.
  Future<void> clearUserContent() async {
    final db = await database;
    await db.delete('pet');
    await db.delete('diary_entries');
    await db.delete('reminders');
    await db.delete('documents');
    final rootPath = await appStorageRootPath();
    for (final sub in ['attachments', 'documents']) {
      await local_fs.deleteDirRecursive(p.join(rootPath, sub));
      await local_fs.ensureDir(p.join(rootPath, sub));
    }
    await local_fs.deleteFileIfExists(p.join(rootPath, 'pet_photo.jpg'));
    await ensureStorageDirs();
  }

  Future<String?> getSetting(String key) async {
    final db = await database;
    final rows = await db.query('settings', where: 'key = ?', whereArgs: [key]);
    if (rows.isEmpty) return null;
    return rows.first['value'] as String;
  }

  Future<void> setSetting(String key, String value) async {
    final db = await database;
    await db.insert(
      'settings',
      {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<PetProfile?> getPet() async {
    final db = await database;
    final rows = await db.query('pet', where: 'id = ?', whereArgs: [1]);
    if (rows.isEmpty) return null;
    return PetProfile.fromMap(rows.first);
  }

  Future<void> upsertPet(PetProfile pet) async {
    final db = await database;
    await db.insert(
      'pet',
      pet.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> deletePet() async {
    final db = await database;
    await db.delete('pet', where: 'id = ?', whereArgs: [1]);
  }

  Future<List<DiaryEntry>> getDiaryEntries({
    DiaryEntryType? typeFilter,
    DateTime? from,
    DateTime? to,
  }) async {
    final db = await database;
    final where = <String>[];
    final args = <Object?>[];
    if (typeFilter != null) {
      where.add('type = ?');
      args.add(typeFilter.name);
    }
    if (from != null) {
      where.add('date_ms >= ?');
      args.add(from.millisecondsSinceEpoch);
    }
    if (to != null) {
      where.add('date_ms <= ?');
      args.add(to.millisecondsSinceEpoch);
    }
    final w = where.isEmpty ? null : where.join(' AND ');
    final rows = await db.query(
      'diary_entries',
      where: w,
      whereArgs: args.isEmpty ? null : args,
      orderBy: 'date_ms DESC',
    );
    return rows.map(DiaryEntry.fromMap).toList();
  }

  Future<int> insertDiary(DiaryEntry e) async {
    final db = await database;
    return db.insert('diary_entries', {
      'date_ms': e.date.millisecondsSinceEpoch,
      'type': e.type.name,
      'text': e.text,
      'status': e.status,
      'attachment_paths': e.attachmentPaths.join('|'),
    });
  }

  Future<void> updateDiary(DiaryEntry e) async {
    final db = await database;
    await db.update(
      'diary_entries',
      {
        'date_ms': e.date.millisecondsSinceEpoch,
        'type': e.type.name,
        'text': e.text,
        'status': e.status,
        'attachment_paths': e.attachmentPaths.join('|'),
      },
      where: 'id = ?',
      whereArgs: [e.id],
    );
  }

  Future<void> deleteDiary(int id) async {
    final db = await database;
    await db.delete('diary_entries', where: 'id = ?', whereArgs: [id]);
  }

  Future<List<Reminder>> getReminders() async {
    final db = await database;
    final rows = await db.query('reminders', orderBy: 'next_fire_at_ms ASC');
    return rows.map(Reminder.fromMap).toList();
  }

  Future<List<Reminder>> getEnabledReminders() async {
    final db = await database;
    final rows = await db.query(
      'reminders',
      where: 'enabled = 1',
      orderBy: 'next_fire_at_ms ASC',
    );
    return rows.map(Reminder.fromMap).toList();
  }

  Future<int> insertReminder(Reminder r) async {
    final db = await database;
    return db.insert('reminders', {
      'title': r.title,
      'scheduled_at_ms': r.scheduledAt.millisecondsSinceEpoch,
      'repeat': r.repeat.name,
      'next_fire_at_ms': r.nextFireAt.millisecondsSinceEpoch,
      'enabled': r.enabled ? 1 : 0,
    });
  }

  Future<void> updateReminder(Reminder r) async {
    final db = await database;
    await db.update(
      'reminders',
      {
        'title': r.title,
        'scheduled_at_ms': r.scheduledAt.millisecondsSinceEpoch,
        'repeat': r.repeat.name,
        'next_fire_at_ms': r.nextFireAt.millisecondsSinceEpoch,
        'enabled': r.enabled ? 1 : 0,
      },
      where: 'id = ?',
      whereArgs: [r.id],
    );
  }

  Future<void> deleteReminder(int id) async {
    final db = await database;
    await db.delete('reminders', where: 'id = ?', whereArgs: [id]);
  }

  Future<List<SavedDocument>> getDocuments() async {
    final db = await database;
    final rows = await db.query('documents', orderBy: 'added_ms DESC');
    return rows.map(SavedDocument.fromMap).toList();
  }

  Future<int> insertDocument({
    required String fileName,
    required String mime,
    required String localPath,
  }) async {
    final db = await database;
    return db.insert('documents', {
      'file_name': fileName,
      'mime': mime,
      'local_path': localPath,
      'added_ms': DateTime.now().millisecondsSinceEpoch,
    });
  }

  Future<void> deleteDocument(int id) async {
    final db = await database;
    await db.delete('documents', where: 'id = ?', whereArgs: [id]);
  }

  Future<SavedDocument?> getDocumentById(int id) async {
    final db = await database;
    final rows = await db.query('documents', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    return SavedDocument.fromMap(rows.first);
  }
}

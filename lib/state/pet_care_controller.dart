import 'package:flutter/material.dart';
import 'package:path/path.dart' as p;

import '../data/petcare_database.dart';
import '../models/diary_entry.dart';
import '../models/pet_profile.dart';
import '../models/reminder.dart';
import '../models/saved_document.dart';
import '../platform/local_fs.dart' as local_fs;
import '../services/notification_service.dart';
import 'pet_care_export_stub.dart' if (dart.library.io) 'pet_care_export_io.dart' as pet_export;

class PetCareController extends ChangeNotifier {
  PetProfile? pet;
  List<DiaryEntry> diary = [];
  List<Reminder> reminders = [];
  List<SavedDocument> documents = [];
  ThemeMode themeMode = ThemeMode.system;

  DiaryEntryType? diaryTypeFilter;
  DateTime? diaryFrom;
  DateTime? diaryTo;

  bool loading = true;

  Future<void> load() async {
    loading = true;
    notifyListeners();
    final db = PetcareDatabase.instance;
    pet = await db.getPet();
    final fromDay = diaryFrom == null
        ? null
        : DateTime(diaryFrom!.year, diaryFrom!.month, diaryFrom!.day);
    final toDay = diaryTo == null
        ? null
        : DateTime(diaryTo!.year, diaryTo!.month, diaryTo!.day, 23, 59, 59, 999);
    diary = await db.getDiaryEntries(
      typeFilter: diaryTypeFilter,
      from: fromDay,
      to: toDay,
    );
    reminders = await db.getReminders();
    documents = await db.getDocuments();
    final t = await db.getSetting('theme') ?? 'system';
    themeMode = switch (t) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    await NotificationService.rescheduleAll(reminders.where((r) => r.enabled));
    loading = false;
    notifyListeners();
  }

  void setDiaryFilters({
    DiaryEntryType? type,
    DateTime? from,
    DateTime? to,
    bool clearType = false,
    bool clearFrom = false,
    bool clearTo = false,
  }) {
    if (clearType) {
      diaryTypeFilter = null;
    } else if (type != null) {
      diaryTypeFilter = type;
    }
    if (clearFrom) {
      diaryFrom = null;
    } else if (from != null) {
      diaryFrom = from;
    }
    if (clearTo) {
      diaryTo = null;
    } else if (to != null) {
      diaryTo = to;
    }
    load();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    themeMode = mode;
    final v = switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      _ => 'system',
    };
    await PetcareDatabase.instance.setSetting('theme', v);
    notifyListeners();
  }

  String? validatePet(PetProfile p) {
    if (p.species.trim().isEmpty) return 'Укажите вид';
    if (p.breed.trim().isEmpty) return 'Укажите породу';
    if (p.weightKg <= 0 || p.weightKg > 500) return 'Вес должен быть от 0 до 500 кг';
    if (p.birthDate.isAfter(DateTime.now())) return 'Дата рождения не может быть в будущем';
    return null;
  }

  Future<String?> savePet(PetProfile p) async {
    final err = validatePet(p);
    if (err != null) return err;
    await PetcareDatabase.instance.upsertPet(p);
    pet = p;
    notifyListeners();
    return null;
  }

  Future<void> deletePet() async {
    final path = pet?.photoPath;
    await PetcareDatabase.instance.deletePet();
    if (path != null) await local_fs.deleteFileIfExists(path);
    pet = null;
    notifyListeners();
  }

  String? validateDiary(String text) {
    if (text.trim().isEmpty) return 'Введите текст записи';
    if (text.length > 10000) return 'Не более 10 000 символов';
    return null;
  }

  Future<String?> addDiary({
    required DateTime date,
    required DiaryEntryType type,
    required String text,
    required String status,
    List<String> attachmentPaths = const [],
  }) async {
    final err = validateDiary(text);
    if (err != null) return err;
    await PetcareDatabase.instance.insertDiary(
      DiaryEntry(
        id: 0,
        date: date,
        type: type,
        text: text.trim(),
        status: status.trim().isEmpty ? '—' : status.trim(),
        attachmentPaths: attachmentPaths,
      ),
    );
    await load();
    return null;
  }

  Future<String?> updateDiary(DiaryEntry e) async {
    final err = validateDiary(e.text);
    if (err != null) return err;
    await PetcareDatabase.instance.updateDiary(
      DiaryEntry(
        id: e.id,
        date: e.date,
        type: e.type,
        text: e.text.trim(),
        status: e.status.trim().isEmpty ? '—' : e.status.trim(),
        attachmentPaths: e.attachmentPaths,
      ),
    );
    await load();
    return null;
  }

  Future<void> deleteDiary(int id) async {
    await PetcareDatabase.instance.deleteDiary(id);
    await load();
  }

  String? validateReminderTitle(String title) {
    if (title.trim().isEmpty) return 'Введите название';
    if (title.length > 200) return 'Слишком длинный заголовок';
    return null;
  }

  Future<String?> saveReminder({
    int? id,
    required String title,
    required DateTime scheduledAt,
    required ReminderRepeat repeat,
    required bool enabled,
  }) async {
    final err = validateReminderTitle(title);
    if (err != null) return err;
    final next = scheduledAt;
    final db = PetcareDatabase.instance;
    if (id == null) {
      final newId = await db.insertReminder(
        Reminder(
          id: 0,
          title: title.trim(),
          scheduledAt: scheduledAt,
          repeat: repeat,
          nextFireAt: next,
          enabled: enabled,
        ),
      );
      if (enabled) {
        await NotificationService.scheduleReminder(
          Reminder(
            id: newId,
            title: title.trim(),
            scheduledAt: scheduledAt,
            repeat: repeat,
            nextFireAt: next,
            enabled: enabled,
          ),
        );
      }
    } else {
      await NotificationService.cancel(id);
      final r = Reminder(
        id: id,
        title: title.trim(),
        scheduledAt: scheduledAt,
        repeat: repeat,
        nextFireAt: next,
        enabled: enabled,
      );
      await db.updateReminder(r);
      if (enabled) await NotificationService.scheduleReminder(r);
    }
    await load();
    return null;
  }

  Future<void> setReminderEnabled(Reminder r, bool enabled) async {
    await NotificationService.cancel(r.id);
    final u = r.copyWith(enabled: enabled);
    await PetcareDatabase.instance.updateReminder(u);
    if (enabled) await NotificationService.scheduleReminder(u);
    await load();
  }

  Future<void> deleteReminder(int id) async {
    await NotificationService.cancel(id);
    await PetcareDatabase.instance.deleteReminder(id);
    await load();
  }

  Future<String?> addDocumentFromFile({
    required String sourcePath,
    required String fileName,
    required String mime,
  }) async {
    const allowed = {'application/pdf', 'image/jpeg', 'image/png'};
    if (!allowed.contains(mime)) return 'Допустимы только PDF, JPG, PNG';
    final rootPath = await PetcareDatabase.appStorageRootPath();
    final safeName = '${DateTime.now().millisecondsSinceEpoch}_$fileName';
    final dest = p.join(rootPath, 'documents', safeName);
    await local_fs.copyFile(sourcePath, dest);
    await PetcareDatabase.instance.insertDocument(
      fileName: fileName,
      mime: mime,
      localPath: dest,
    );
    await load();
    return null;
  }

  Future<void> deleteDocument(SavedDocument d) async {
    await local_fs.deleteFileIfExists(d.localPath);
    await PetcareDatabase.instance.deleteDocument(d.id);
    await load();
  }

  Future<String> stagePetPhoto(String pickedPath) async {
    final rootPath = await PetcareDatabase.appStorageRootPath();
    final dest = p.join(rootPath, 'pet_photo.jpg');
    await local_fs.copyFile(pickedPath, dest);
    return dest;
  }

  Future<String> stageDiaryAttachment(String sourcePath, String name) async {
    final rootPath = await PetcareDatabase.appStorageRootPath();
    final dest = p.join(rootPath, 'attachments', '${DateTime.now().millisecondsSinceEpoch}_$name');
    await local_fs.copyFile(sourcePath, dest);
    return dest;
  }

  Future<void> exportData(BuildContext context) async {
    await pet_export.runPetCareExport(context);
  }

  Future<void> clearUserData() async {
    await NotificationService.cancelAll();
    await PetcareDatabase.instance.clearUserContent();
    pet = null;
    diary = [];
    reminders = [];
    documents = [];
    notifyListeners();
    await load();
  }

  Future<void> factoryReset() async {
    await NotificationService.cancelAll();
    await PetcareDatabase.instance.wipeAll();
    await load();
  }
}

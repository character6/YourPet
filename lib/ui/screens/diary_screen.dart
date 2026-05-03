import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:path/path.dart' as path_lib;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/diary_entry.dart';
import '../../state/pet_care_controller.dart';

class DiaryScreen extends StatelessWidget {
  const DiaryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<PetCareController>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Дневник здоровья'),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () => _showFilters(context, c),
          ),
        ],
      ),
      body: c.loading
          ? const Center(child: CircularProgressIndicator())
          : c.diary.isEmpty
              ? const Center(child: Text('Пока нет записей.\nДобавьте первую — кнопка «+».'))
              : ListView.builder(
                  itemCount: c.diary.length,
                  itemBuilder: (context, i) {
                    final e = c.diary[i];
                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      child: ListTile(
                        title: Text(e.text, maxLines: 2, overflow: TextOverflow.ellipsis),
                        subtitle: Text(
                          '${DateFormat.yMMMd('ru').format(e.date)} · ${e.type.label} · ${e.status}',
                        ),
                        isThreeLine: true,
                        onTap: () => _openEditor(context, c, e),
                        trailing: PopupMenuButton<String>(
                          onSelected: (v) async {
                            if (v == 'del') {
                              await c.deleteDiary(e.id);
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Запись удалена')),
                                );
                              }
                            }
                          },
                          itemBuilder: (ctx) => [
                            const PopupMenuItem(value: 'del', child: Text('Удалить')),
                          ],
                        ),
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _openEditor(context, c, null),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showFilters(BuildContext context, PetCareController c) {
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Фильтры', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('Все типы'),
                    selected: c.diaryTypeFilter == null,
                    onSelected: (_) {
                      Navigator.pop(ctx);
                      c.setDiaryFilters(clearType: true);
                    },
                  ),
                  for (final t in DiaryEntryType.values)
                    ChoiceChip(
                      label: Text(t.label),
                      selected: c.diaryTypeFilter == t,
                      onSelected: (_) {
                        Navigator.pop(ctx);
                        c.setDiaryFilters(type: t);
                      },
                    ),
                ],
              ),
              const SizedBox(height: 12),
              ListTile(
                title: const Text('Дата с'),
                subtitle: Text(
                  c.diaryFrom == null ? '—' : DateFormat.yMMMd('ru').format(c.diaryFrom!),
                ),
                onTap: () async {
                  final d = await showDatePicker(
                    context: ctx,
                    initialDate: c.diaryFrom ?? DateTime.now(),
                    firstDate: DateTime(2000),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (d != null) {
                    Navigator.pop(ctx);
                    c.setDiaryFilters(from: d);
                  }
                },
              ),
              ListTile(
                title: const Text('Дата по'),
                subtitle: Text(
                  c.diaryTo == null ? '—' : DateFormat.yMMMd('ru').format(c.diaryTo!),
                ),
                onTap: () async {
                  final d = await showDatePicker(
                    context: ctx,
                    initialDate: c.diaryTo ?? DateTime.now(),
                    firstDate: DateTime(2000),
                    lastDate: DateTime.now().add(const Duration(days: 365)),
                  );
                  if (d != null) {
                    Navigator.pop(ctx);
                    c.setDiaryFilters(to: d);
                  }
                },
              ),
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  c.setDiaryFilters(clearType: true, clearFrom: true, clearTo: true);
                },
                child: const Text('Сбросить фильтры'),
              ),
            ],
          ),
        );
      },
    );
  }
}

Future<void> _openEditor(BuildContext context, PetCareController c, DiaryEntry? existing) async {
  final textCtrl = TextEditingController(text: existing?.text ?? '');
  final statusCtrl = TextEditingController(text: existing?.status == '—' ? '' : (existing?.status ?? ''));
  var type = existing?.type ?? DiaryEntryType.note;
  var date = existing?.date ?? DateTime.now();
  final attachments = List<String>.from(existing?.attachmentPaths ?? []);

  Future<void> addAttachment() async {
    final r = await FilePicker.platform.pickFiles();
    if (r == null || r.files.single.path == null) return;
    final path = r.files.single.path!;
    final name = r.files.single.name;
    final staged = await c.stageDiaryAttachment(path, name);
    attachments.add(staged);
  }

  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) {
      return Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          top: 16,
          bottom: MediaQuery.viewInsetsOf(ctx).bottom + 16,
        ),
        child: StatefulBuilder(
          builder: (ctx, setSt) {
            return SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    existing == null ? 'Новая запись' : 'Редактирование',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 12),
                  ListTile(
                    title: const Text('Дата'),
                    subtitle: Text(DateFormat.yMMMd('ru').format(date)),
                    onTap: () async {
                      final d = await showDatePicker(
                        context: ctx,
                        initialDate: date,
                        firstDate: DateTime(2000),
                        lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
                      );
                      if (d != null) setSt(() => date = d);
                    },
                  ),
                  DropdownButtonFormField<DiaryEntryType>(
                    value: type,
                    decoration: const InputDecoration(labelText: 'Тип'),
                    items: DiaryEntryType.values
                        .map((t) => DropdownMenuItem(value: t, child: Text(t.label)))
                        .toList(),
                    onChanged: (v) => setSt(() => type = v ?? DiaryEntryType.note),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: textCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Текст *',
                      border: OutlineInputBorder(),
                    ),
                    minLines: 3,
                    maxLines: 8,
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: statusCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Статус',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Вложения: ${attachments.length}'),
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      await addAttachment();
                      setSt(() {});
                    },
                    icon: const Icon(Icons.attach_file),
                    label: const Text('Добавить файл'),
                  ),
                  for (final p in attachments)
                    ListTile(
                      dense: true,
                      title: Text(path_lib.basename(p), maxLines: 1),
                      trailing: IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          setSt(() => attachments.remove(p));
                        },
                      ),
                    ),
                  FilledButton(
                    onPressed: () async {
                      final err = existing == null
                          ? await c.addDiary(
                              date: date,
                              type: type,
                              text: textCtrl.text,
                              status: statusCtrl.text,
                              attachmentPaths: attachments,
                            )
                          : await c.updateDiary(
                              DiaryEntry(
                                id: existing.id,
                                date: date,
                                type: type,
                                text: textCtrl.text,
                                status: statusCtrl.text,
                                attachmentPaths: attachments,
                              ),
                            );
                      if (!ctx.mounted) return;
                      if (err != null) {
                        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(err)));
                        return;
                      }
                      Navigator.pop(ctx);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Сохранено')),
                      );
                    },
                    child: const Text('Сохранить'),
                  ),
                ],
              ),
            );
          },
        ),
      );
    },
  );
}

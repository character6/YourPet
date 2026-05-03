import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/reminder.dart';
import '../../state/pet_care_controller.dart';

class RemindersScreen extends StatelessWidget {
  const RemindersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<PetCareController>();
    return Scaffold(
      appBar: AppBar(title: const Text('Напоминания')),
      body: c.loading
          ? const Center(child: CircularProgressIndicator())
          : c.reminders.isEmpty
              ? const Center(
                  child: Text(
                    'Нет напоминаний.\nДобавьте прививку, обработку или осмотр.',
                    textAlign: TextAlign.center,
                  ),
                )
              : ListView.builder(
                  itemCount: c.reminders.length,
                  itemBuilder: (context, i) {
                    final r = c.reminders[i];
                    return Card(
                      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      child: ListTile(
                        title: Text(r.title),
                        subtitle: Text(
                          '${DateFormat('d.MM.yyyy HH:mm', 'ru').format(r.scheduledAt)} · ${r.repeat.label}',
                        ),
                        trailing: Switch(
                          value: r.enabled,
                          onChanged: (v) => c.setReminderEnabled(r, v),
                        ),
                        onTap: () => _edit(context, c, r),
                        onLongPress: () async {
                          final ok = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Удалить напоминание?'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Нет')),
                                FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Да')),
                              ],
                            ),
                          );
                          if (ok == true && context.mounted) await c.deleteReminder(r.id);
                        },
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _edit(context, c, null),
        child: const Icon(Icons.add),
      ),
    );
  }
}

Future<void> _edit(BuildContext context, PetCareController c, Reminder? existing) async {
  final titleCtrl = TextEditingController(text: existing?.title ?? '');
  var repeat = existing?.repeat ?? ReminderRepeat.once;
  var scheduled = existing?.scheduledAt ?? DateTime.now().add(const Duration(hours: 1));
  var enabled = existing?.enabled ?? true;

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
                    existing == null ? 'Новое напоминание' : 'Редактирование',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: titleCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Название *',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                  ListTile(
                    title: const Text('Дата и время'),
                    subtitle: Text(DateFormat('d.MM.yyyy HH:mm', 'ru').format(scheduled)),
                    onTap: () async {
                      final d = await showDatePicker(
                        context: ctx,
                        initialDate: scheduled,
                        firstDate: DateTime(2000),
                        lastDate: DateTime(2100),
                      );
                      if (d == null) return;
                      if (!ctx.mounted) return;
                      final t = await showTimePicker(
                        context: ctx,
                        initialTime: TimeOfDay.fromDateTime(scheduled),
                      );
                      if (t == null) return;
                      setSt(() {
                        scheduled = DateTime(d.year, d.month, d.day, t.hour, t.minute);
                      });
                    },
                  ),
                  DropdownButtonFormField<ReminderRepeat>(
                    value: repeat,
                    decoration: const InputDecoration(labelText: 'Повтор'),
                    items: ReminderRepeat.values
                        .map((e) => DropdownMenuItem(value: e, child: Text(e.label)))
                        .toList(),
                    onChanged: (v) => setSt(() => repeat = v ?? ReminderRepeat.once),
                  ),
                  SwitchListTile(
                    title: const Text('Включено'),
                    value: enabled,
                    onChanged: (v) => setSt(() => enabled = v),
                  ),
                  FilledButton(
                    onPressed: () async {
                      final err = await c.saveReminder(
                        id: existing?.id,
                        title: titleCtrl.text,
                        scheduledAt: scheduled,
                        repeat: repeat,
                        enabled: enabled,
                      );
                      if (!ctx.mounted) return;
                      if (err != null) {
                        ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(err)));
                        return;
                      }
                      Navigator.pop(ctx);
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

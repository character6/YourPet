import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/pet_care_controller.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = context.watch<PetCareController>();
    return Scaffold(
      appBar: AppBar(title: const Text('Настройки')),
      body: ListView(
        children: [
          const ListTile(title: Text('Тема оформления')),
          RadioListTile<ThemeMode>(
            title: const Text('Как в системе'),
            value: ThemeMode.system,
            groupValue: c.themeMode,
            onChanged: (v) {
              if (v != null) c.setThemeMode(v);
            },
          ),
          RadioListTile<ThemeMode>(
            title: const Text('Светлая'),
            value: ThemeMode.light,
            groupValue: c.themeMode,
            onChanged: (v) {
              if (v != null) c.setThemeMode(v);
            },
          ),
          RadioListTile<ThemeMode>(
            title: const Text('Тёмная'),
            value: ThemeMode.dark,
            groupValue: c.themeMode,
            onChanged: (v) {
              if (v != null) c.setThemeMode(v);
            },
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.ios_share_outlined),
            title: const Text('Экспорт данных'),
            subtitle: const Text('Архив БД и файлов для резервной копии'),
            onTap: c.loading ? null : () => c.exportData(context),
          ),
          ListTile(
            leading: const Icon(Icons.delete_sweep_outlined),
            title: const Text('Очистить данные'),
            subtitle: const Text('Питомец, дневник, напоминания, документы. Тема сохранится.'),
            onTap: c.loading
                ? null
                : () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Очистить все данные?'),
                        content: const Text('Настройки темы останутся.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
                          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Очистить')),
                        ],
                      ),
                    );
                    if (ok == true && context.mounted) {
                      await c.clearUserData();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Данные очищены')),
                      );
                    }
                  },
          ),
          ListTile(
            leading: const Icon(Icons.restore),
            title: const Text('Сброс к заводским'),
            subtitle: const Text('Удалит всё, включая тему, как после установки'),
            onTap: c.loading
                ? null
                : () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Сброс к заводским?'),
                        content: const Text('Восстановить будет нельзя без резервной копии.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
                          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Сбросить')),
                        ],
                      ),
                    );
                    if (ok == true && context.mounted) {
                      await c.factoryReset();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Сброс выполнен')),
                      );
                    }
                  },
          ),
          const SizedBox(height: 24),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'Работает без интернета. Документы и БД хранятся в каталоге приложения, не в системном кэше.',
              style: TextStyle(fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

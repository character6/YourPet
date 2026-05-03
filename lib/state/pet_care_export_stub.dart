import 'package:flutter/material.dart';

Future<void> runPetCareExport(BuildContext context) async {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    const SnackBar(
      content: Text(
        'Экспорт ZIP в браузере не поддерживается. Откройте приложение на Android или Windows.',
      ),
    ),
  );
}

import 'package:flutter/material.dart';

import '../../models/saved_document.dart';

Widget documentViewerPage(BuildContext context, SavedDocument doc) {
  return Scaffold(
    appBar: AppBar(title: Text(doc.fileName)),
    body: const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Просмотр сохранённых файлов в браузере не поддерживается. '
          'Откройте приложение на Android или Windows.',
          textAlign: TextAlign.center,
        ),
      ),
    ),
  );
}

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/saved_document.dart';
import '../../state/pet_care_controller.dart';
import 'document_viewer_screen.dart';

class DocumentsScreen extends StatelessWidget {
  const DocumentsScreen({super.key});

  static const _ext = ['pdf', 'jpg', 'jpeg', 'png'];

  @override
  Widget build(BuildContext context) {
    final c = context.watch<PetCareController>();
    return Scaffold(
      appBar: AppBar(title: const Text('Документы')),
      body: c.loading
          ? const Center(child: CircularProgressIndicator())
          : c.documents.isEmpty
              ? const Center(
                  child: Text(
                    'Нет файлов.\nДобавьте PDF, JPG или PNG — они хранятся в памяти приложения, не в кэше ОС.',
                    textAlign: TextAlign.center,
                  ),
                )
              : ListView.builder(
                  itemCount: c.documents.length,
                  itemBuilder: (context, i) {
                    final d = c.documents[i];
                    return ListTile(
                      leading: Icon(d.mime.contains('pdf') ? Icons.picture_as_pdf : Icons.image),
                      title: Text(d.fileName),
                      subtitle: Text(d.mime),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => DocumentViewerScreen(doc: d),
                          ),
                        );
                      },
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline),
                        onPressed: () async {
                          final ok = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text('Удалить файл?'),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Нет')),
                                FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Да')),
                              ],
                            ),
                          );
                          if (ok == true && context.mounted) await c.deleteDocument(d);
                        },
                      ),
                    );
                  },
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final r = await FilePicker.platform.pickFiles(
            type: FileType.custom,
            allowedExtensions: _ext,
          );
          if (r == null || r.files.single.path == null) return;
          final f = r.files.single;
          final mime = _mimeFor(f.extension ?? '');
          final err = await c.addDocumentFromFile(
            sourcePath: f.path!,
            fileName: f.name,
            mime: mime,
          );
          if (!context.mounted) return;
          if (err != null) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
          }
        },
        child: const Icon(Icons.upload_file),
      ),
    );
  }

  static String _mimeFor(String ext) {
    switch (ext.toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      default:
        return 'application/octet-stream';
    }
  }
}

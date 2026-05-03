import 'dart:io';

import 'package:flutter/material.dart';
import 'package:pdfx/pdfx.dart';

import '../../models/saved_document.dart';
import '../../platform/local_fs.dart' as local_fs;

Widget documentViewerPage(BuildContext context, SavedDocument doc) {
  return _DocumentViewerIo(doc: doc);
}

class _DocumentViewerIo extends StatefulWidget {
  const _DocumentViewerIo({required this.doc});

  final SavedDocument doc;

  @override
  State<_DocumentViewerIo> createState() => _DocumentViewerIoState();
}

class _DocumentViewerIoState extends State<_DocumentViewerIo> {
  PdfController? _pdf;
  var _pdfError = false;

  @override
  void initState() {
    super.initState();
    if (widget.doc.mime == 'application/pdf') {
      try {
        _pdf = PdfController(
          document: PdfDocument.openFile(widget.doc.localPath),
        );
      } catch (_) {
        _pdfError = true;
      }
    }
  }

  @override
  void dispose() {
    _pdf?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final path = widget.doc.localPath;
    if (!local_fs.fileExistsSync(path)) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.doc.fileName)),
        body: const Center(child: Text('Файл не найден')),
      );
    }
    final file = File(path);

    if (widget.doc.mime == 'application/pdf') {
      if (_pdfError || _pdf == null) {
        return Scaffold(
          appBar: AppBar(title: Text(widget.doc.fileName)),
          body: const Center(child: Text('Не удалось открыть PDF')),
        );
      }
      return Scaffold(
        appBar: AppBar(title: Text(widget.doc.fileName)),
        body: PdfView(controller: _pdf!),
      );
    }

    if (widget.doc.mime == 'image/jpeg' || widget.doc.mime == 'image/png') {
      return Scaffold(
        appBar: AppBar(title: Text(widget.doc.fileName)),
        body: InteractiveViewer(
          minScale: 0.5,
          maxScale: 4,
          child: Center(child: Image.file(file)),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(widget.doc.fileName)),
      body: const Center(child: Text('Неподдерживаемый тип')),
    );
  }
}

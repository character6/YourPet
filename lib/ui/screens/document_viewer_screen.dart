import 'package:flutter/material.dart';

import '../../models/saved_document.dart';
import 'document_viewer_stub.dart' if (dart.library.io) 'document_viewer_io.dart' as dv;

class DocumentViewerScreen extends StatelessWidget {
  const DocumentViewerScreen({super.key, required this.doc});

  final SavedDocument doc;

  @override
  Widget build(BuildContext context) => dv.documentViewerPage(context, doc);
}

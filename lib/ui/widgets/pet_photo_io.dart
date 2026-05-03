import 'dart:io';

import 'package:flutter/material.dart';

import '../../platform/local_fs.dart' as local_fs;

Widget petPhotoPreview(String path) {
  if (!local_fs.fileExistsSync(path)) {
    return Container(
      height: 160,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Text('Файл фото не найден'),
    );
  }
  return ClipRRect(
    borderRadius: BorderRadius.circular(12),
    child: AspectRatio(
      aspectRatio: 4 / 3,
      child: Image.file(File(path), fit: BoxFit.cover),
    ),
  );
}

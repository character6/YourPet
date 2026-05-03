import 'package:flutter/material.dart';

Widget petPhotoPreview(String path) {
  return ClipRRect(
    borderRadius: BorderRadius.circular(12),
    child: Container(
      height: 160,
      alignment: Alignment.center,
      color: Colors.grey.shade200,
      child: const Padding(
        padding: EdgeInsets.all(12),
        child: Text(
          'Превью фото в браузере недоступно. Полный функционал — в Android / Windows.',
          textAlign: TextAlign.center,
        ),
      ),
    ),
  );
}

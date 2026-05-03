import 'package:flutter/widgets.dart';

import 'pet_photo_web.dart' if (dart.library.io) 'pet_photo_io.dart' as impl;

Widget petPhotoPreview(String path) => impl.petPhotoPreview(path);

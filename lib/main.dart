import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';

import 'app/pet_care_app.dart';
import 'data/petcare_database.dart';
import 'services/notification_service.dart';
import 'state/pet_care_controller.dart';
import 'web_db_stub.dart' if (dart.library.html) 'web_db.dart' as web_db;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await web_db.configureWebDatabase();

  try {
    await initializeDateFormatting('ru', null);
    await NotificationService.init();
    await PetcareDatabase.instance.init();
    final controller = PetCareController();
    await controller.load();
    runApp(
      ChangeNotifierProvider<PetCareController>.value(
        value: controller,
        child: const PetCareApp(),
      ),
    );
  } catch (e, st) {
    debugPrint('Ошибка запуска: $e\n$st');
    runApp(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: SelectableText('Ошибка запуска:\n$e'),
            ),
          ),
        ),
      ),
    );
  }
}

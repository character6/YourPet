import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/pet_care_controller.dart';
import 'shell.dart';

class PetCareApp extends StatelessWidget {
  const PetCareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<PetCareController>(
      builder: (context, c, _) {
        return MaterialApp(
          title: 'Уход за питомцем',
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2E7D32)),
            useMaterial3: true,
          ),
          darkTheme: ThemeData(
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF66BB6A),
              brightness: Brightness.dark,
            ),
            useMaterial3: true,
          ),
          themeMode: c.themeMode,
          home: const AppShell(),
        );
      },
    );
  }
}

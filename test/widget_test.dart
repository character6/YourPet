import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:project_tp/app/pet_care_app.dart';
import 'package:project_tp/state/pet_care_controller.dart';

void main() {
  testWidgets('PetCareApp: нижняя навигация отображается', (WidgetTester tester) async {
    TestWidgetsFlutterBinding.ensureInitialized();

    final controller = PetCareController()..loading = false;

    await tester.pumpWidget(
      ChangeNotifierProvider<PetCareController>.value(
        value: controller,
        child: const PetCareApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Питомец'), findsOneWidget);
    expect(find.text('Дневник'), findsOneWidget);
    expect(find.text('Напоминания'), findsOneWidget);
    expect(find.text('Документы'), findsOneWidget);
    expect(find.text('Настройки'), findsOneWidget);
  });
}

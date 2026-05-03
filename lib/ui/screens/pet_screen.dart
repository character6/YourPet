import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/pet_profile.dart';
import '../../state/pet_care_controller.dart';
import '../widgets/pet_photo.dart';

class PetScreen extends StatefulWidget {
  const PetScreen({super.key});

  @override
  State<PetScreen> createState() => _PetScreenState();
}

class _PetScreenState extends State<PetScreen> {
  final _species = TextEditingController();
  final _breed = TextEditingController();
  final _weight = TextEditingController();
  DateTime? _birth;
  String? _photoPath;
  var _editing = false;
  String? _lastPetKey;

  @override
  void dispose() {
    _species.dispose();
    _breed.dispose();
    _weight.dispose();
    super.dispose();
  }

  void _fill(PetProfile? p) {
    if (p == null) {
      _species.clear();
      _breed.clear();
      _weight.clear();
      _birth = null;
      _photoPath = null;
      _editing = true;
      return;
    }
    _species.text = p.species;
    _breed.text = p.breed;
    _weight.text = p.weightKg.toString();
    _birth = p.birthDate;
    _photoPath = p.photoPath;
    _editing = false;
  }

  Future<void> _pickPhoto(PetCareController c) async {
    final x = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (x == null) return;
    final raw = x.path;
    if (raw == null || raw.isEmpty) {
      if (mounted) {
        _toast('Выбор фото в браузере ограничен. Используйте Android или Windows.');
      }
      return;
    }
    final path = await c.stagePetPhoto(raw);
    setState(() => _photoPath = path);
  }

  Future<void> _save(PetCareController c) async {
    final birth = _birth ?? DateTime.now();
    final w = double.tryParse(_weight.text.replaceAll(',', '.'));
    if (w == null) {
      _toast('Введите корректный вес');
      return;
    }
    final p = PetProfile(
      species: _species.text,
      breed: _breed.text,
      birthDate: birth,
      weightKg: w,
      photoPath: _photoPath,
    );
    final err = await c.savePet(p);
    if (!mounted) return;
    if (err != null) {
      _toast(err);
      return;
    }
    setState(() => _editing = false);
    _toast('Сохранено');
  }

  void _toast(String m) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.watch<PetCareController>();
    if (c.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final pet = c.pet;
    final key = pet == null ? 'none' : '${pet.species}|${pet.breed}|${pet.weightKg}|${pet.birthDate.toIso8601String()}|${pet.photoPath ?? ''}';
    if (!_editing && _lastPetKey != key) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() {
          _fill(pet);
          _lastPetKey = key;
          _editing = pet == null;
        });
      });
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Профиль питомца'),
        actions: [
          if (pet != null && !_editing)
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () => setState(() => _editing = true),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_photoPath != null)
            petPhotoPreview(_photoPath!)
          else
            Container(
              height: 160,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Text('Фото не выбрано'),
            ),
          const SizedBox(height: 12),
          if (_editing || pet == null) ...[
            FilledButton.icon(
              onPressed: () => _pickPhoto(c),
              icon: const Icon(Icons.photo_camera_back_outlined),
              label: const Text('Выбрать фото'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _species,
              decoration: const InputDecoration(labelText: 'Вид *', border: OutlineInputBorder()),
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _breed,
              decoration: const InputDecoration(labelText: 'Порода *', border: OutlineInputBorder()),
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 12),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Дата рождения *'),
              subtitle: Text(
                _birth == null ? 'Не выбрана' : DateFormat.yMMMd('ru').format(_birth!),
              ),
              trailing: const Icon(Icons.calendar_month),
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _birth ?? DateTime(2020),
                  firstDate: DateTime(1990),
                  lastDate: DateTime.now(),
                );
                if (d != null) setState(() => _birth = d);
              },
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _weight,
              decoration: const InputDecoration(
                labelText: 'Вес, кг *',
                border: OutlineInputBorder(),
              ),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 24),
            FilledButton(onPressed: () => _save(c), child: const Text('Сохранить')),
            if (pet != null) ...[
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () async {
                  await c.deletePet();
                  if (mounted) {
                    setState(() {
                      _fill(null);
                      _lastPetKey = 'none';
                      _editing = true;
                    });
                  }
                },
                child: const Text('Удалить профиль'),
              ),
            ],
          ] else ...[
            ListTile(title: const Text('Вид'), subtitle: Text(pet!.species)),
            ListTile(title: const Text('Порода'), subtitle: Text(pet.breed)),
            ListTile(
              title: const Text('Дата рождения'),
              subtitle: Text(DateFormat.yMMMd('ru').format(pet.birthDate)),
            ),
            ListTile(title: const Text('Вес'), subtitle: Text('${pet.weightKg} кг')),
          ],
        ],
      ),
    );
  }
}

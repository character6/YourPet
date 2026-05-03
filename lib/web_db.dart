import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart';

/// Web SQLite без Shared Worker: в [web/sqlite3.wasm] должен быть **тот же major**, что и
/// транзитивный `package:sqlite3` в pubspec.lock (см. `sqlite3-x.y.z` на GitHub).
/// Скачать: https://github.com/simolus3/sqlite3.dart/releases/download/sqlite3-3.3.1/sqlite3.wasm
/// (wasm из ветки 2.x вызывает `WebAssembly.instantiate ... env`).
Future<void> configureWebDatabase() async {
  databaseFactory = databaseFactoryFfiWebNoWebWorker;
}

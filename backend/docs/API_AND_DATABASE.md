# Бэкенд Pet Care MVP — схема данных и API (Firebase)

Документ закрывает задачи **B02** (схема), **B08** (описание для клиента). Аутентификация — **Firebase Auth** (email/password). Данные — **Cloud Firestore**. Файлы — **Firebase Storage**. Push — **FCM** + локальные уведомления на клиенте.

## Коллекции Firestore

Все документы основных сущностей содержат поле **`userId`** (`string`, равно `request.auth.uid`). Доступ только к своим документам — см. `backend/firebase/firestore.rules`.

### `users/{userId}`

| Поле | Тип | Описание |
|------|-----|----------|
| `displayName` | string? | Имя пользователя |
| `email` | string? | Email (дублировать необязательно) |
| `fcmTokens` | string[]? | Токены FCM для облачных push (B06) |
| `createdAt` | timestamp? | Создание профиля |
| `updatedAt` | timestamp? | Обновление |

### `pets/{petId}`

Один питомец в MVP на уровне приложения; в облаке допускается несколько записей для будущего мультипрофиля.

| Поле | Тип | Описание |
|------|-----|----------|
| `userId` | string | Владелец |
| `species` | string | Вид |
| `breed` | string | Порода |
| `birthDate` | timestamp \| string | Дата рождения (в правилах допускаются оба типа) |
| `weightKg` | number | Текущий вес, кг |
| `photoStoragePath` | string? | Путь в Storage, см. раздел «Файлы» |
| `localId` | string? | ID из локальной БД (offline-first) |
| `syncedAt` | timestamp? | Время последней успешной синхронизации |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `diary_entries/{entryId}`

| Поле | Тип | Описание |
|------|-----|----------|
| `userId` | string | |
| `petId` | string | Ссылка на документ в `pets` |
| `date` | timestamp | Дата записи (для фильтров) |
| `type` | string | `symptom` \| `visit` \| `note` |
| `text` | string | Текст, до 10 000 символов |
| `attachmentPaths` | string[]? | Пути файлов в Storage |
| `status` | string | Произвольный статус MVP, до 64 символов |
| `localId` | string? | |
| `syncedAt` | timestamp? | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Индексы (B02):** см. `firestore.indexes.json` — пары `userId` + `date`, `userId` + `type` + `date`.

### `reminders/{reminderId}`

| Поле | Тип | Описание |
|------|-----|----------|
| `userId` | string | |
| `petId` | string | |
| `title` | string | Заголовок напоминания |
| `scheduledAt` | timestamp | Запланированное время/дата |
| `repeat` | string | `once` \| `daily` \| `weekly` \| `by_date` |
| `nextFireAt` | timestamp \| null | Следующее срабатывание (для запросов и FCM) |
| `timezone` | string? | IANA, например `Europe/Moscow` |
| `enabled` | bool? | Включено ли |
| `localId` | string? | |
| `syncedAt` | timestamp? | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Индекс:** `userId` + `nextFireAt` (напоминания «к срабатыванию»).

### `documents/{docId}`

| Поле | Тип | Описание |
|------|-----|----------|
| `userId` | string | |
| `petId` | string | |
| `fileName` | string | Исходное имя файла |
| `mimeType` | string | `application/pdf` \| `image/jpeg` \| `image/png` |
| `storagePath` | string | Полный путь объекта в Storage |
| `sizeBytes` | int | Размер, не больше 15 728 640 (15 МБ) |
| `uploadedAt` | timestamp | |
| `localId` | string? | |
| `syncedAt` | timestamp? | |
| `updatedAt` | timestamp | |

### `sync_queue/{jobId}` (B05)

Очередь для offline-first: клиент создаёт job, затем применяет изменения к основным коллекциям или обрабатывает через Functions.

| Поле | Тип | Описание |
|------|-----|----------|
| `userId` | string | |
| `entity` | string | Имя сущности, например `pet`, `diary_entry` |
| `operation` | string | `create` \| `update` \| `delete` |
| `createdAt` | timestamp? | Рекомендуется `serverTimestamp()` |
| `payload` | map? | Данные (по соглашению с клиентом; при необходимости добавьте в `firestore.rules`) |

> **Примечание:** обязательные поля в правилах: `userId`, `entity`, `operation`.

## Firebase Storage

Шаблон пути (согласован с `storage.rules`):

```text
users/{userId}/pets/{petId}/{fileName}
```

`contentType`: PDF, JPEG, PNG. Максимальный размер объекта: **15 МБ**.

После загрузки сохраните `storagePath` в `pets.photoStoragePath`, в `diary_entries.attachmentPaths` или в метаданных `documents`.

## Примеры запросов (клиентские SDK)

Ниже — логические операции; синтаксис зависит от платформы (Flutter: `cloud_firestore`).

### Получить питомцев пользователя

```text
collection("pets").where("userId", "==", uid).orderBy("updatedAt", descending: true)
```

### Дневник за период и по типу

```text
collection("diary_entries")
  .where("userId", "==", uid)
  .where("type", "==", "symptom")
  .where("date", ">=", start)
  .where("date", "<=", end)
  .orderBy("date", descending: true)
```

При комбинации фильтров может потребоваться составной индекс — см. консоль Firestore или `firestore.indexes.json`.

### Ближайшие напоминания

```text
collection("reminders")
  .where("userId", "==", uid)
  .where("nextFireAt", ">=", now)
  .orderBy("nextFireAt")
  .limit(20)
```

## Callable Functions (HTTPS)

После деплоя (`firebase deploy --only functions`):

| Функция | Назначение |
|---------|------------|
| `registerDeviceToken` | Тело: `{ "token": "<FCM>" }`. Сохраняет токен в `users/{uid}` |
| `health` | Проверка живости бэкенда |

Вызов только для авторизованного пользователя (Firebase Auth ID token).

## Стратегия синхронизации (B05)

1. Запись в локальную БД (SQLite / Hive и т.д.) — источник истины в офлайне.
2. При сети: batch write в Firestore + обновление `syncedAt` / `localId` mapping.
3. Опционально: запись в `sync_queue` для аудита или обработки `onSyncJobCreated`.
4. Конфликты: для учебного MVP — «последняя запись по `updatedAt` побеждает» или версионирование поля `revision` (вне MVP).

## Мониторинг (B07)

- **Crashlytics** — подключение в Android/iOS проекте Flutter; необязательно для Functions.
- **Sentry** — опционально обернуть `functions` (SDK для Node) в `src/index.ts`.
- Логи очереди: Cloud Logging + триггер `onSyncJobCreated`.

## Соответствие задачам B01–B08

| ID | Реализация в репозитории |
|----|-------------------------|
| B01 | `backend/README.md` — шаги создания проекта Firebase, включение Auth, Firestore, Storage, FCM; шаблон `.firebaserc.example` |
| B02 | Коллекции и индексы в этом файле и `firestore.indexes.json` |
| B03 | `firestore.rules`, `storage.rules` |
| B04 | На стороне клиента: Email/Password, Secure Storage; сервер — правила по `request.auth.uid` |
| B05 | Описание выше + коллекция `sync_queue` + триггер-заглушка в `functions` |
| B06 | `registerDeviceToken`, регистрация приложения в FCM; fallback — локальные уведомления в ОС |
| B07 | Раздел «Мониторинг» + точка расширения в коде Functions |
| B08 | Этот документ |

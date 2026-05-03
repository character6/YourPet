# Бэкенд учебного приложения «Уход за питомцем» (Firebase)

Инфраструктура для пост-MVP синхронизации: **Firebase Auth**, **Cloud Firestore**, **Cloud Storage**, **Cloud Functions**, **FCM**.

## Требования

- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm i -g firebase-tools`)
- Node.js **20** (для Cloud Functions)
- Аккаунт Google и проект в [Firebase Console](https://console.firebase.google.com/)

## B01: создание облачного проекта

1. Создайте проект в Firebase Console.
2. Включите **Authentication** → провайдер **Email/Password**.
3. Создайте базу **Firestore** (режим production или test — для продакшена задеплойте правила из `firebase/firestore.rules`).
4. Включите **Storage** с дефолтным bucket.
5. Включите **Cloud Messaging** (FCM) и при необходимости загрузите ключи для iOS (APNs).
6. Скопируйте `backend/firebase/.firebaserc.example` в `backend/firebase/.firebaserc` и подставьте **project id**.
7. В корне Flutter-проекта добавьте конфиги SDK (из консоли: «Настройки проекта» → «Ваши приложения»):
   - Android: `android/app/google-services.json`
   - iOS: `ios/Runner/GoogleService-Info.plist`  
   Эти файлы **не коммитьте** с реальными ключами в публичный репозиторий (используйте CI secrets или примеры без секретов).

## Деплой правил и индексов

```bash
cd backend/firebase
firebase login
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Индексы могут строиться несколько минут после первого деплоя.

## Деплой Cloud Functions

```bash
cd backend/functions
npm install
npm run build
cd ../firebase
firebase deploy --only functions
```

После деплоя в консоли Firebase появятся функции `registerDeviceToken`, `health`, триггер `onSyncJobCreated`.

## Локальная эмуляция

Из каталога `backend/firebase`:

```bash
firebase emulators:start
```

Эмулятор UI: `http://localhost:4000`. Подключите Flutter к эмуляторам согласно документации `firebase_core` / `cloud_firestore`.

## Структура каталогов

```text
backend/
  firebase/
    firebase.json
    firestore.rules
    firestore.indexes.json
    storage.rules
    .firebaserc.example
  functions/
    package.json
    tsconfig.json
    src/index.ts
  docs/
    API_AND_DATABASE.md
```

## Дальнейшие шаги для мобильной команды

- Реализовать **B04**: регистрация/вход, хранение refresh-сессии (например `flutter_secure_storage`).
- Для **MVP без облака** можно не подключать Firebase в клиенте; бэкенд остаётся готовым к включению синхронизации.
- Подробные схемы полей и примеры запросов: **`docs/API_AND_DATABASE.md`**.

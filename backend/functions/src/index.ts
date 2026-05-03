import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

/**
 * B06: регистрация FCM-токена устройства (вызывать из Flutter после получения токена).
 * Токены хранятся в users/{uid}.fcmTokens (массив строк, дедупликация на клиенте или здесь).
 */
export const registerDeviceToken = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Требуется вход");
  }
  const token = request.data?.token as string | undefined;
  if (!token || typeof token !== "string" || token.length > 4096) {
    throw new HttpsError("invalid-argument", "Некорректный FCM token");
  }

  const uid = request.auth.uid;
  const userRef = admin.firestore().doc(`users/${uid}`);
  await userRef.set(
    {
      fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { ok: true };
});

/**
 * B05 (заглушка): при создании job в sync_queue можно добавить обработку (валидация, метрики).
 * Реальная синхронизация сущностей обычно выполняется клиентом через batch writes в основные коллекции.
 */
export const onSyncJobCreated = onDocumentCreated("sync_queue/{jobId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  const data = snap.data();
  // Пример: логирование для B07 (Crashlytics/Sentry — на стороне клиента/Functions SDK)
  console.log("sync_queue job", snap.id, data?.entity, data?.operation);
});

/**
 * Проверка доступности Functions (диагностика после деплоя).
 */
export const health = onCall(async () => ({ status: "ok", ts: new Date().toISOString() }));

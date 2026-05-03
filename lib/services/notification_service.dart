import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;
import 'package:flutter_timezone/flutter_timezone.dart';

import '../models/reminder.dart';

class NotificationService {
  NotificationService._();
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static var _ready = false;

  static Future<void> init() async {
    if (_ready) return;
    tz_data.initializeTimeZones();
    if (kIsWeb) {
      tz.setLocalLocation(tz.UTC);
      _ready = true;
      return;
    }
    try {
      final name = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(name));
    } catch (_) {
      tz.setLocalLocation(tz.UTC);
    }

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings();
    await _plugin.initialize(
      const InitializationSettings(android: android, iOS: ios),
    );

    final androidImpl = _plugin.resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin>();
    await androidImpl?.createNotificationChannel(
      const AndroidNotificationChannel(
        'petcare_reminders',
        'Напоминания',
        description: 'Прививки, обработки, осмотры',
        importance: Importance.high,
      ),
    );
    _ready = true;
  }

  static Future<bool> ensureNotificationPermission() async {
    if (kIsWeb) return true;
    if (defaultTargetPlatform != TargetPlatform.android &&
        defaultTargetPlatform != TargetPlatform.iOS) {
      return true;
    }
    final status = await Permission.notification.status;
    if (status.isGranted) return true;
    final r = await Permission.notification.request();
    return r.isGranted;
  }

  static Future<void> cancel(int notificationId) async {
    if (kIsWeb) return;
    await _plugin.cancel(notificationId);
  }

  static Future<void> cancelAll() async {
    if (kIsWeb) return;
    await _plugin.cancelAll();
  }

  static Future<void> scheduleReminder(Reminder r) async {
    if (kIsWeb) return;
    if (!r.enabled) return;
    await ensureNotificationPermission();

    final scheduled = _computeSchedule(r);
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'petcare_reminders',
        'Напоминания',
        channelDescription: 'Локальные напоминания',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    );

    final match = switch (r.repeat) {
      ReminderRepeat.daily => DateTimeComponents.time,
      ReminderRepeat.weekly => DateTimeComponents.dayOfWeekAndTime,
      _ => null,
    };

    Future<void> schedule(AndroidScheduleMode mode) async {
      await _plugin.zonedSchedule(
        r.id,
        'Напоминание',
        r.title,
        scheduled,
        details,
        androidScheduleMode: mode,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: match,
        payload: 'reminder_${r.id}',
      );
    }

    try {
      await schedule(AndroidScheduleMode.exactAllowWhileIdle);
    } catch (_) {
      await schedule(AndroidScheduleMode.inexactAllowWhileIdle);
    }
  }

  static tz.TZDateTime _computeSchedule(Reminder r) {
    final now = tz.TZDateTime.now(tz.local);
    final t = r.scheduledAt;
    switch (r.repeat) {
      case ReminderRepeat.once:
      case ReminderRepeat.byDate:
        var z = tz.TZDateTime.from(r.nextFireAt, tz.local);
        if (!z.isAfter(now)) {
          z = now.add(const Duration(minutes: 1));
        }
        return z;
      case ReminderRepeat.daily:
        var z = tz.TZDateTime(
          tz.local,
          now.year,
          now.month,
          now.day,
          t.hour,
          t.minute,
        );
        if (!z.isAfter(now)) {
          z = z.add(const Duration(days: 1));
        }
        return z;
      case ReminderRepeat.weekly:
        var candidate = tz.TZDateTime(
          tz.local,
          now.year,
          now.month,
          now.day,
          t.hour,
          t.minute,
        );
        while (candidate.weekday != t.weekday || !candidate.isAfter(now)) {
          candidate = candidate.add(const Duration(days: 1));
        }
        return candidate;
    }
  }

  static Future<void> rescheduleAll(Iterable<Reminder> reminders) async {
    if (kIsWeb) return;
    await cancelAll();
    for (final r in reminders) {
      if (r.enabled) await scheduleReminder(r);
    }
  }
}

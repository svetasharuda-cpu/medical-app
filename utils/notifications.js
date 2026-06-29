import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Notifications = Platform.OS !== 'web' ? require('expo-notifications') : null;

export async function requestPermissions() {
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleNotificationsForMed(med) {
  if (!Notifications) return;
  await cancelNotificationsForMed(med.id);
  if (!med.remindersEnabled || !med.times || med.times.length === 0) return;

  const granted = await requestPermissions();
  if (!granted) return;

  const ids = [];
  for (const time of med.times) {
    const parts = time.split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (isNaN(hour) || isNaN(minute)) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `💊 Час прийняти ${med.name}`,
        body: med.dosage ? `Дозування: ${med.dosage}` : 'Не забудьте прийняти ліки!',
        sound: true,
        data: { medId: med.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    ids.push(id);
  }

  await AsyncStorage.setItem(`notif_${med.id}`, JSON.stringify(ids));
}

export async function cancelNotificationsForMed(medId) {
  if (!Notifications) return;
  try {
    const stored = await AsyncStorage.getItem(`notif_${medId}`);
    if (stored) {
      const ids = JSON.parse(stored);
      for (const id of ids) {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
      await AsyncStorage.removeItem(`notif_${medId}`);
    }
  } catch (_) {}
}

// Parses DD.MM.YYYY → Date at 09:00
function parseUADate(str) {
  if (!str) return null;
  const parts = str.split('.');
  if (parts.length !== 3) return null;
  const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 9, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

export async function scheduleEndOfCourseReminder(med) {
  if (!Notifications) return;
  await cancelEndOfCourseReminder(med.id);
  if (!med.endDate) return;

  const fireDate = parseUADate(med.endDate);
  if (!fireDate || fireDate <= new Date()) return;

  const granted = await requestPermissions();
  if (!granted) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🗓 Курс лікування завершено',
      body: `Курс «${med.name}» закінчився. Запишіться до лікаря для консультації.`,
      sound: true,
      data: { type: 'end_of_course', medId: med.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
    },
  });

  await AsyncStorage.setItem(`notif_end_${med.id}`, id);
}

export async function cancelEndOfCourseReminder(medId) {
  if (!Notifications) return;
  try {
    const id = await AsyncStorage.getItem(`notif_end_${medId}`);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(`notif_end_${medId}`);
    }
  } catch (_) {}
}

// Native (iOS/Android) notification service backed by expo-notifications.
// This file is only bundled on native platforms (Metro resolves the *.native.ts
// override); the web bundle uses notifications.ts and never imports this module.
//
// Full background/local delivery on iOS requires a development build (not Expo Go
// for all features) — see app.json plugin config.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

let initialised = false;

export function notificationsSupported(): boolean {
  return true;
}

function toState(status: Notifications.PermissionStatus | string): PermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'default';
}

export function getPermission(): PermissionState {
  // Synchronous best-effort; native callers should prefer requestPermission().
  return 'default';
}

export async function requestPermission(): Promise<PermissionState> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    const res = await Notifications.requestPermissionsAsync();
    return toState(res.status);
  } catch {
    return 'denied';
  }
}

export function initNotifications(): void {
  if (initialised) return;
  initialised = true;
  Notifications.setNotificationHandler({
    handleNotification: async () =>
      ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      } as any),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => {});
  }
}

export function showSystemNotification(title: string, body?: string): void {
  Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  }).catch(() => {});
}

// ---- Scheduling (true background delivery) ----

export function canScheduleOS(): boolean {
  return true;
}

function idFor(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '_');
}

export async function scheduleOSNotification(
  key: string,
  when: Date,
  title: string,
  body?: string,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: idFor(key),
      content: { title, body },
      trigger: { date: when } as any,
    });
  } catch {
    /* ignore */
  }
}

export async function cancelOSNotification(key: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(idFor(key));
  } catch {
    /* ignore */
  }
}

export async function cancelAllOSNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* ignore */
  }
}

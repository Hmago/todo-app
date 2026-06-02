// Web (and default) notification service. Uses the browser Notification API and,
// when available, a service worker for better mobile display + click handling.
// NOTE: time-based delivery while the tab is fully closed requires Web Push (a
// server + VAPID keys), which is out of scope for this local-first app. Here the
// service worker improves foreground/PWA display and notification clicks.

import { asset } from './basePath';

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';


let swReg: ServiceWorkerRegistration | null = null;

function hasNotificationApi(): boolean {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined';
}

/** OS-level notifications are supported (web Notification API present). */
export function notificationsSupported(): boolean {
  return hasNotificationApi();
}

export function getPermission(): PermissionState {
  if (!hasNotificationApi()) return 'unsupported';
  return Notification.permission as PermissionState;
}

export async function requestPermission(): Promise<PermissionState> {
  if (!hasNotificationApi()) return 'unsupported';
  try {
    return (await Notification.requestPermission()) as PermissionState;
  } catch {
    return 'denied';
  }
}

/** Register the service worker (best-effort). Safe to call multiple times. */
export function initNotifications(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (swReg) return;
  navigator.serviceWorker
    .register(asset('/service-worker.js'), { scope: asset('/') })
    .then((reg) => {
      swReg = reg;
    })
    .catch(() => {
      /* SW unavailable (e.g. not served) — fall back to Notification ctor */
    });
}

/** Show an OS notification immediately (web). No-op if not permitted. */
export function showSystemNotification(title: string, body?: string): void {
  if (!hasNotificationApi() || Notification.permission !== 'granted') return;
  try {
    if (swReg) {
      swReg.showNotification(title, { body, icon: asset('/pwa-icon.png'), tag: title });
      return;
    }
    // eslint-disable-next-line no-new
    new Notification(title, { body, icon: asset('/pwa-icon.png') });
  } catch {
    /* ignore */
  }
}

// ---- Scheduling (OS background delivery) ----
// The web platform cannot schedule local notifications for a closed tab without
// Web Push. The in-app scheduler (useReminders) handles foreground delivery.

export function canScheduleOS(): boolean {
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function scheduleOSNotification(
  _key: string,
  _when: Date,
  _title: string,
  _body?: string,
): Promise<void> {
  /* not supported on web */
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function cancelOSNotification(_key: string): Promise<void> {
  /* no-op */
}

export async function cancelAllOSNotifications(): Promise<void> {
  /* no-op */
}

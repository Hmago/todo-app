// Web (and default) notification service. Uses the browser Notification API and,
// when available, a service worker for better mobile display + click handling.
// In Electron (desktop), prefers the `window.desktopAPI` IPC bridge so the
// main process can show *native* OS notifications and keep firing scheduled
// reminders even when the window is hidden or minimized to the tray.

import { asset } from './basePath';

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';


let swReg: ServiceWorkerRegistration | null = null;

interface DesktopAPI {
  isDesktop: true;
  notify: (title: string, body?: string) => Promise<boolean>;
  schedule: (key: string, whenMs: number, title: string, body?: string) => Promise<boolean>;
  cancel: (key: string) => Promise<boolean>;
  cancelAll: () => Promise<boolean>;
}

function desktop(): DesktopAPI | null {
  if (typeof window === 'undefined') return null;
  const api = (window as unknown as { desktopAPI?: DesktopAPI }).desktopAPI;
  return api && api.isDesktop ? api : null;
}

function hasNotificationApi(): boolean {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined';
}

/** OS-level notifications are supported (Electron bridge OR web Notification API). */
export function notificationsSupported(): boolean {
  return !!desktop() || hasNotificationApi();
}

export function getPermission(): PermissionState {
  // Electron's main-process Notification module does not require a permission
  // prompt — the host OS handles toast suppression / focus assist.
  if (desktop()) return 'granted';
  if (!hasNotificationApi()) return 'unsupported';
  return Notification.permission as PermissionState;
}

export async function requestPermission(): Promise<PermissionState> {
  if (desktop()) return 'granted';
  if (!hasNotificationApi()) return 'unsupported';
  try {
    return (await Notification.requestPermission()) as PermissionState;
  } catch {
    return 'denied';
  }
}

/** Register the service worker (best-effort). Safe to call multiple times. */
export function initNotifications(): void {
  if (desktop()) return; // Electron path handles its own delivery.
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

/** Show an OS notification immediately. No-op if not permitted. */
export function showSystemNotification(title: string, body?: string): void {
  const d = desktop();
  if (d) {
    d.notify(title, body).catch(() => {
      /* ignore */
    });
    return;
  }
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
// On Electron the main process owns a setTimeout-based scheduler that fires
// native Notifications even when the window is hidden / minimised to tray.
// On the web platform there is no way to deliver a scheduled notification
// while the tab is fully closed without Web Push (server + VAPID keys), which
// is out of scope here — the in-app scheduler (useReminders) handles
// foreground delivery instead.

export function canScheduleOS(): boolean {
  return !!desktop();
}

export async function scheduleOSNotification(
  key: string,
  when: Date,
  title: string,
  body?: string,
): Promise<void> {
  const d = desktop();
  if (!d) return;
  try {
    await d.schedule(key, when.getTime(), title, body);
  } catch {
    /* ignore */
  }
}

export async function cancelOSNotification(key: string): Promise<void> {
  const d = desktop();
  if (!d) return;
  try {
    await d.cancel(key);
  } catch {
    /* ignore */
  }
}

export async function cancelAllOSNotifications(): Promise<void> {
  const d = desktop();
  if (!d) return;
  try {
    await d.cancelAll();
  } catch {
    /* ignore */
  }
}

import { Platform } from 'react-native';

/**
 * Web-only PWA bootstrap. Injects the manifest link + install/meta tags into the
 * document head and registers the service worker so the app is installable and
 * works offline. No-op on native. Safe to call multiple times.
 */
let done = false;

export function registerPWA(): void {
  if (Platform.OS !== 'web') return;
  if (done) return;
  const g: any = globalThis;
  const doc = g.document;
  if (!doc || !doc.head) return;
  done = true;

  try {
    doc.title = 'To Do';
  } catch (e) {
    /* ignore */
  }

  const ensure = (selector: string, create: () => any) => {
    if (doc.querySelector(selector)) return;
    doc.head.appendChild(create());
  };
  const meta = (name: string, content: string) => {
    const m = doc.createElement('meta');
    m.setAttribute('name', name);
    m.setAttribute('content', content);
    return m;
  };

  ensure('link[rel="manifest"]', () => {
    const l = doc.createElement('link');
    l.rel = 'manifest';
    l.href = '/manifest.webmanifest';
    return l;
  });
  ensure('meta[name="theme-color"]', () => meta('theme-color', '#1f1f1f'));
  ensure('meta[name="mobile-web-app-capable"]', () => meta('mobile-web-app-capable', 'yes'));
  ensure('meta[name="apple-mobile-web-app-capable"]', () => meta('apple-mobile-web-app-capable', 'yes'));
  ensure('meta[name="apple-mobile-web-app-status-bar-style"]', () =>
    meta('apple-mobile-web-app-status-bar-style', 'black-translucent'),
  );
  ensure('meta[name="apple-mobile-web-app-title"]', () => meta('apple-mobile-web-app-title', 'To Do'));
  ensure('link[rel="apple-touch-icon"]', () => {
    const l = doc.createElement('link');
    l.rel = 'apple-touch-icon';
    l.href = '/pwa-icon.png';
    return l;
  });

  // The service worker is registered by initNotifications(); register here too
  // in case notifications are unsupported, so install/offline still work.
  const nav: any = g.navigator;
  if (nav && 'serviceWorker' in nav) {
    nav.serviceWorker.register('/service-worker.js').catch(() => undefined);
  }
}

let installPrompt: any = null;

/** Wire up the beforeinstallprompt event so we can offer an in-app install. */
export function initInstallPrompt(onAvailable: (available: boolean) => void): () => void {
  if (Platform.OS !== 'web') return () => undefined;
  const g: any = globalThis;
  const w = g.window;
  if (!w) return () => undefined;

  const onBeforeInstall = (e: any) => {
    e.preventDefault();
    installPrompt = e;
    onAvailable(true);
  };
  const onInstalled = () => {
    installPrompt = null;
    onAvailable(false);
  };
  w.addEventListener('beforeinstallprompt', onBeforeInstall);
  w.addEventListener('appinstalled', onInstalled);
  return () => {
    w.removeEventListener('beforeinstallprompt', onBeforeInstall);
    w.removeEventListener('appinstalled', onInstalled);
  };
}

/** True when running as an installed standalone PWA. */
export function isStandalone(): boolean {
  if (Platform.OS !== 'web') return false;
  const g: any = globalThis;
  const w = g.window;
  if (!w) return false;
  return (
    (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) ||
    g.navigator?.standalone === true
  );
}

/** Show the native install prompt if the browser offered one. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!installPrompt) return 'unavailable';
  try {
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    installPrompt = null;
    return choice?.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    return 'unavailable';
  }
}

import { Platform } from 'react-native';
import { asset } from './basePath';

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

  // Viewport must opt into the safe-area insets (viewport-fit=cover) and lock
  // zoom so the layout doesn't "shake" when inputs focus or the toolbar resizes.
  try {
    let vp = doc.querySelector('meta[name="viewport"]');
    if (!vp) {
      vp = doc.createElement('meta');
      vp.setAttribute('name', 'viewport');
      doc.head.appendChild(vp);
    }
    vp.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
    );
  } catch (e) {
    /* ignore */
  }

  // Global web styles: pin the app to the viewport, kill rubber-band/overscroll,
  // honour the safe-area insets, and prevent iOS zoom-on-focus jitter.
  ensure('style[data-app-pwa]', () => {
    const s = doc.createElement('style');
    s.setAttribute('data-app-pwa', '');
    s.textContent = [
      'html,body{margin:0;padding:0;height:100%;width:100%;overflow:hidden;overscroll-behavior:none;}',
      '#root{position:fixed;top:0;left:0;right:0;bottom:0;overflow:hidden;}',
      '#app-root{position:fixed;top:0;left:0;right:0;bottom:0;}',
      '*{-webkit-tap-highlight-color:transparent;}',
      // iOS zooms (and jitters) when focusing inputs smaller than 16px.
      'input,textarea,select{font-size:16px;}',
      // Respect the top notch and the bottom home-indicator.
      '#app-root{padding-top:env(safe-area-inset-top);}',
      '#app-tabbar{padding-bottom:calc(env(safe-area-inset-bottom) + 6px) !important;}',
    ].join('\n');
    return s;
  });

  ensure('link[rel="manifest"]', () => {
    const l = doc.createElement('link');
    l.rel = 'manifest';
    l.href = asset('/manifest.webmanifest');
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
    l.href = asset('/pwa-icon.png');
    return l;
  });

  // The service worker is registered by initNotifications(); register here too
  // in case notifications are unsupported, so install/offline still work.
  const nav: any = g.navigator;
  if (nav && 'serviceWorker' in nav) {
    // Auto-reload when a *new* service worker takes control, so a freshly
    // deployed build replaces a stale one without the user clearing the cache
    // (critical for installed home-screen PWAs, which otherwise resume the old
    // in-memory page on reopen).
    const hadController = !!nav.serviceWorker.controller;
    let reloading = false;
    nav.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      try {
        g.location.reload();
      } catch (e) {
        /* ignore */
      }
    });

    nav.serviceWorker
      .register(asset('/service-worker.js'), { scope: asset('/') })
      .then((reg: any) => {
        // Check for a new version on launch and whenever the app regains focus.
        const check = () => {
          try {
            reg.update();
          } catch (e) {
            /* ignore */
          }
        };
        check();
        try {
          doc.addEventListener('visibilitychange', () => {
            if (doc.visibilityState === 'visible') check();
          });
        } catch (e) {
          /* ignore */
        }
      })
      .catch(() => undefined);
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

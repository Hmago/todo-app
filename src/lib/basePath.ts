/**
 * Resolves the web base path the app is served under. When deployed to GitHub
 * Pages at https://USER.github.io/todo-app/ the base is "/todo-app"; locally and
 * at a domain root it is "". Driven by Expo's `experiments.baseUrl` which is
 * inlined as `process.env.EXPO_BASE_URL` at build time.
 */
export function getBasePath(): string {
  const raw = (process.env.EXPO_BASE_URL || '').trim();
  if (!raw || raw === '/') return '';
  // Normalize to a leading slash, no trailing slash: "/todo-app".
  const withLead = raw.startsWith('/') ? raw : `/${raw}`;
  return withLead.replace(/\/+$/, '');
}

/** Join the base path with an absolute-from-root asset path, e.g. "/pwa-icon.png". */
export function asset(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getBasePath()}${p}`;
}

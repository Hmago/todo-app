import AsyncStorage from '@react-native-async-storage/async-storage';

/** Every Zustand persist store in this app shares this key prefix. */
const APP_KEY_PREFIX = 'learnplan-';

/** UTF-8 byte length of a string, with a manual fallback when TextEncoder is absent. */
export function utf8ByteLength(str: string): number {
  const g: any = globalThis;
  if (typeof g.TextEncoder !== 'undefined') {
    try {
      return new g.TextEncoder().encode(str).length;
    } catch {
      /* fall through to manual count */
    }
  }
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4; // surrogate pair = one 4-byte code point
      i++; // skip the trailing low surrogate
    } else bytes += 3;
  }
  return bytes;
}

/**
 * Total bytes this app occupies in persistent storage (AsyncStorage on native,
 * localStorage on web). Sums every persisted store keyed under APP_KEY_PREFIX,
 * counting both the key and its serialized value.
 */
export async function getStorageUsageBytes(): Promise<number> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(APP_KEY_PREFIX));
    if (keys.length === 0) return 0;
    const entries = await AsyncStorage.multiGet(keys);
    let total = 0;
    for (const [key, value] of entries) {
      total += utf8ByteLength(key);
      if (value) total += utf8ByteLength(value);
    }
    return total;
  } catch {
    return 0;
  }
}

/** Human-friendly byte size in KB/MB, e.g. "12.4 KB", "1.23 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

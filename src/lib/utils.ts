import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeFormatDate(dateValue: any, formatOpts?: Intl.DateTimeFormatOptions): string {
  if (!dateValue) return '-';
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', formatOpts || { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return '-';
  }
}

/**
 * Recursively removes all keys with `undefined` values from an object or array.
 * Required for Firestore because setDoc/updateDoc throws an error on `undefined`.
 */
export function removeUndefined<T>(val: T): T {
  if (val === undefined) return undefined as any;
  if (val === null || typeof val !== 'object' || val instanceof Date) return val;
  if (Array.isArray(val)) {
    return val.map(item => removeUndefined(item)) as any;
  }
  const cleaned: any = {};
  for (const [key, value] of Object.entries(val)) {
    if (value === undefined) continue;
    cleaned[key] = removeUndefined(value);
  }
  return cleaned as T;
}

/**
 * Detects if a string is a raw system ID / Firebase UID (e.g. 2Pb0ULQhtbZpVvQeOJIU3dNEw)
 */
export function isRawId(str?: string | null): boolean {
  if (!str) return false;
  const s = str.trim();
  // Typically 18-36 alphanumeric characters without spaces, or doc/log id prefixes like reg_ or gl_
  return (/^[a-zA-Z0-9_-]{18,36}$/.test(s) && !s.includes(' ')) || /^(reg_|gl_|usr_|comp_)/.test(s);
}

/**
 * Returns a human-friendly display name, preventing raw IDs or 'unknown' from leaking into the UI.
 */
export function getFriendlyDisplayName(
  name?: string | null,
  email?: string | null,
  fallback = 'Siswa'
): string {
  if (name && name.trim() && !isRawId(name) && name.toLowerCase() !== 'unknown') {
    return name.trim();
  }
  if (email && email.trim()) {
    const handle = email.split('@')[0];
    if (handle && !isRawId(handle)) {
      return handle
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }
  }
  return fallback;
}


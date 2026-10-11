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

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

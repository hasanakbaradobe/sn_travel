/**
 * Local-timezone date formatting utilities.
 * Prevents off-by-one-day bugs caused by UTC `.toISOString().split('T')[0]` in non-UTC timezones.
 */

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysLocal(days: number, from: Date = new Date()): string {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return getLocalDateString(next);
}

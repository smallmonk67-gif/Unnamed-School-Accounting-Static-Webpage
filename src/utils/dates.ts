export const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 7, label: 'Sunday', short: 'Sun' },
];

export function getDayName(dayNumber: any): string {
  const day = DAYS_OF_WEEK.find(d => d.value === Number(dayNumber));
  return day ? day.label : 'Unknown';
}

export function getDayShortName(dayNumber: any): string {
  const day = DAYS_OF_WEEK.find(d => d.value === Number(dayNumber));
  return day ? day.short : 'Unknown';
}

export function formatDate(isoDateString: any): string {
  if (!isoDateString) return '-';
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return isoDateString;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return isoDateString;
  }
}

export function formatDateTime(isoString: any): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export function calculateAge(birthdayString: any): string {
  if (!birthdayString) return '';
  const birth = new Date(birthdayString);
  if (isNaN(birth.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? `${age} yrs` : '';
}

export function getCurrentPeriod(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getTodayDate(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

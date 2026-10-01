export function entryWhen(entry: { createdAt: string; eventAt?: string }): string {
  return entry.eventAt ?? entry.createdAt;
}

export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMonth(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

export function daysAgo(n: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(20, 0, 0, 0);
  return d.toISOString();
}

export function monthGrid(year: number, monthIndex: number): { iso: string; inMonth: boolean; day: number }[] {
  const first = new Date(year, monthIndex, 1);
  const startPad = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - startPad);
  const cells: { iso: string; inMonth: boolean; day: number }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    date.setHours(12, 0, 0, 0);
    cells.push({
      iso: dayKey(date.toISOString()),
      inMonth: date.getMonth() === monthIndex,
      day: date.getDate(),
    });
  }
  while (cells.length > 7 && cells.slice(-7).every((cell) => !cell.inMonth)) {
    cells.splice(cells.length - 7, 7);
  }
  return cells;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

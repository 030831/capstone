// 공용 유틸: id 생성·깊은 복사·묶음(chunk).
export function uid(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** 배열을 size 개씩 묶는다 — 그림을 '한 줄에 N개' 배치할 때 쓴다. */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size) || 1);
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export function clampNumber(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (x: number): string => String(x).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

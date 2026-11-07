// 저장·복원·백업 (지시서 §12).
// - 새 저장 키(worksheet-creator:v1): 기존 검사기 키(alignment-checker-v0:students)와 별개.
// - 기존 학생 데이터는 읽기만 하고 삭제·덮어쓰지 않는다(지시서 §4.2).
// - 손상된 데이터: 앱을 멈추지 않고, 원본을 즉시 덮어쓰지 않고, 백업 후 새 작업을 제공한다.
// - 백업(JSON): 형식·버전 검사, 잘못된 파일은 이유와 함께 거부, 기존 작업 조용히 덮어쓰지 않음.
import { uid } from './util';
import type { CreatorDoc, Problem, ProblemSet, StudentRef, Work } from './types';

export const STORAGE_KEY = 'worksheet-creator:v1';
export const LEGACY_CHECKER_KEY = 'alignment-checker-v0:students'; // 기존 검사기 저장 키(읽기 전용)
const FORMAT = 'worksheet-creator';
const VERSION = 1;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

// ── 형식 검증 ─────────────────────────────────────────────

const KINDS = ['count', 'two_groups', 'equation', 'compare'] as const;
const PICTOS = ['circle', 'star', 'apple', 'ball'] as const;
const SIZES = ['small', 'medium', 'large'] as const;
const OPS = ['add', 'sub'] as const;
const BLANKS = ['a', 'b', 'result'] as const;
const QMODES = ['more', 'less', 'same'] as const;
const RMODES = ['choice', 'symbol'] as const;
const DISPLAYS = ['pictures', 'equation', 'both'] as const;

type Kind = (typeof KINDS)[number];
type Picto = (typeof PICTOS)[number];
type Size = (typeof SIZES)[number];

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** 문제 1건을 끝까지 검증한다. 하나라도 어긋나면 null (조용히 고쳐 쓰지 않는다). */
function sanitizeProblem(raw: unknown): Problem | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const kind = oneOf<Kind>(p.kind, KINDS);
  if (!isStr(p.id) || !kind) return null;
  if (!isStr(p.question)) return null;
  const questionSize = oneOf<'normal' | 'large'>(p.questionSize, ['normal', 'large']);
  if (!questionSize) return null;

  const resp = p.response;
  if (!resp || typeof resp !== 'object') return null;
  const r = resp as Record<string, unknown>;
  const rMode = oneOf<'blank' | 'choices'>(r.mode, ['blank', 'choices']);
  const blankSize = oneOf<Size>(r.blankSize, SIZES);
  if (!rMode || !blankSize) return null;
  if (!Array.isArray(r.choices) || !r.choices.every(isStr)) return null;
  if (!isNum(r.correctIndex) || r.correctIndex < 0) return null;

  const hint = p.hint;
  if (!hint || typeof hint !== 'object') return null;
  const h = hint as Record<string, unknown>;
  const hPicto = oneOf<Picto>(h.pictogram, PICTOS);
  if (typeof h.enabled !== 'boolean' || !isStr(h.text)) return null;
  if (!isNum(h.pictureCount) || h.pictureCount < 0 || !hPicto) return null;
  if (typeof h.showInPrint !== 'boolean') return null;

  const base = {
    id: p.id,
    kind,
    question: p.question,
    questionSize,
    response: {
      mode: rMode,
      choices: r.choices as string[],
      correctIndex: r.correctIndex,
      blankSize,
    },
    hint: {
      enabled: h.enabled,
      text: h.text,
      pictureCount: h.pictureCount,
      pictogram: hPicto,
      showInPrint: h.showInPrint,
    },
  };

  const group = (v: unknown): { count: number; pictogram: Picto } | null => {
    if (!v || typeof v !== 'object') return null;
    const g = v as Record<string, unknown>;
    const picto = oneOf<Picto>(g.pictogram, PICTOS);
    if (!isNum(g.count) || !picto) return null;
    return { count: g.count, pictogram: picto };
  };

  switch (kind) {
    case 'count': {
      const picto = oneOf<Picto>(p.pictogram, PICTOS);
      const itemSize = oneOf<Size>(p.itemSize, SIZES);
      if (!picto || !isNum(p.count) || !isNum(p.perRow) || !itemSize) return null;
      return { ...base, kind, pictogram: picto, count: p.count, perRow: p.perRow, itemSize };
    }
    case 'two_groups': {
      const left = group(p.left);
      const right = group(p.right);
      const displayMode = oneOf<'pictures' | 'equation' | 'both'>(p.displayMode, DISPLAYS);
      if (!left || !right || !displayMode) return null;
      if (typeof p.showBorder !== 'boolean' || typeof p.showSymbols !== 'boolean') return null;
      return { ...base, kind, left, right, showBorder: p.showBorder, showSymbols: p.showSymbols, displayMode };
    }
    case 'equation': {
      const op = oneOf<'add' | 'sub'>(p.operation, OPS);
      const blank = oneOf<'a' | 'b' | 'result'>(p.blank, BLANKS);
      const picto = oneOf<Picto>(p.pictogram, PICTOS);
      if (!op || !blank || !isNum(p.a) || !isNum(p.b)) return null;
      if (typeof p.showPictures !== 'boolean' || !picto) return null;
      return { ...base, kind, operation: op, a: p.a, b: p.b, blank, showPictures: p.showPictures, pictogram: picto };
    }
    case 'compare': {
      const left = group(p.left);
      const right = group(p.right);
      const qm = oneOf<'more' | 'less' | 'same'>(p.questionMode, QMODES);
      const rm = oneOf<'choice' | 'symbol'>(p.responseMode, RMODES);
      if (!left || !right || !qm || !rm) return null;
      if (typeof p.showPictures !== 'boolean' || typeof p.showNumbers !== 'boolean') return null;
      return { ...base, kind, left, right, showPictures: p.showPictures, showNumbers: p.showNumbers, questionMode: qm, responseMode: rm };
    }
  }
}

function sanitizeSet(raw: unknown): ProblemSet | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (!s.problems || typeof s.problems !== 'object' || !Array.isArray(s.order) || !s.order.every(isStr)) return null;
  const problems: Record<string, Problem> = {};
  for (const [id, pr] of Object.entries(s.problems as Record<string, unknown>)) {
    const clean = sanitizeProblem(pr);
    if (!clean || clean.id !== id) return null;
    problems[id] = clean;
  }
  for (const id of s.order) if (!problems[id]) return null;
  return { problems, order: s.order as string[] };
}

function sanitizeStudent(raw: unknown): StudentRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (!isStr(s.id) || !isStr(s.displayName) || !isStr(s.iepGoal) || !isStr(s.supportNote)) return null;
  if (s.linkedOldId !== undefined && !isStr(s.linkedOldId)) return null;
  return { id: s.id, displayName: s.displayName, iepGoal: s.iepGoal, supportNote: s.supportNote, ...(s.linkedOldId ? { linkedOldId: s.linkedOldId } : {}) };
}

function sanitizeWork(raw: unknown): Work | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Record<string, unknown>;
  if (!isStr(w.id) || !isStr(w.name) || !isNum(w.createdAt) || !isNum(w.updatedAt)) return null;
  if (!isStr(w.selectedVersion) || (w.selectedProblemId !== null && !isStr(w.selectedProblemId))) return null;
  if (!isStr(w.worksheetTitle)) return null;
  if (!Array.isArray(w.students) || !w.students.every((s) => sanitizeStudent(s))) return null;
  const common = sanitizeSet(w.common);
  if (!common) return null;
  const studentSets: Record<string, ProblemSet> = {};
  if (w.studentSets && typeof w.studentSets === 'object') {
    for (const [sid, set] of Object.entries(w.studentSets as Record<string, unknown>)) {
      const clean = sanitizeSet(set);
      if (!clean) return null;
      studentSets[sid] = clean;
    }
  }
  if (w.isExample !== undefined && typeof w.isExample !== 'boolean') return null;
  return {
    id: w.id,
    name: w.name,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    students: w.students.map((s) => sanitizeStudent(s)!),
    common,
    studentSets,
    selectedVersion: w.selectedVersion,
    selectedProblemId: w.selectedProblemId ?? null,
    worksheetTitle: w.worksheetTitle,
    ...(w.isExample ? { isExample: true } : {}),
  };
}

// ── 문서 읽기·쓰기 ─────────────────────────────────────────

export interface LoadResult {
  doc: CreatorDoc | null;
  /** 손상된 원본 원문(백업용). null 이면 손상 아님. */
  corruptRaw: string | null;
  /** 기존 검사기에 있던 학생(표시 이름 연결용, 읽기 전용). */
  legacyStudents: { id: string; name: string }[];
}

export function emptyDoc(): CreatorDoc {
  return { format: FORMAT, version: VERSION, works: [], lastOpenedWorkId: null };
}

export function loadCreator(): LoadResult {
  const legacyStudents = readLegacyStudents();
  const storage = safeStorage();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (!raw) return { doc: null, corruptRaw: null, legacyStudents };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { doc: null, corruptRaw: raw, legacyStudents };
  }
  if (!parsed || typeof parsed !== 'object') return { doc: null, corruptRaw: raw, legacyStudents };
  const d = parsed as Record<string, unknown>;
  if (d.format !== FORMAT || d.version !== VERSION) return { doc: null, corruptRaw: raw, legacyStudents };
  if (!Array.isArray(d.works)) return { doc: null, corruptRaw: raw, legacyStudents };
  const works: Work[] = [];
  for (const w of d.works) {
    const clean = sanitizeWork(w);
    if (!clean) return { doc: null, corruptRaw: raw, legacyStudents };
    works.push(clean);
  }
  const lastOpenedWorkId = isStr(d.lastOpenedWorkId) && works.some((w) => w.id === d.lastOpenedWorkId) ? d.lastOpenedWorkId : null;
  return { doc: { format: FORMAT, version: VERSION, works, lastOpenedWorkId }, corruptRaw: null, legacyStudents };
}

/** 저장한다. 성공 여부를 반환한다(실패를 숨기지 않는다). */
export function saveCreator(doc: CreatorDoc): boolean {
  try {
    const storage = safeStorage();
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

/** 저장된 문서를 지운다(테스트용). */
export function clearCreatorStorage(): void {
  try {
    safeStorage()?.removeItem(STORAGE_KEY);
  } catch {
    /* 무시 */
  }
}

// ── 기존 검사기 학생(읽기 전용 연결) ───────────────────────

export function readLegacyStudents(): { id: string; name: string }[] {
  try {
    const raw = safeStorage()?.getItem(LEGACY_CHECKER_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { students?: { id?: unknown; name?: unknown }[] };
    if (!Array.isArray(data.students)) return [];
    return data.students
      .filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string')
      .map((s) => ({ id: s.id as string, name: s.name as string }));
  } catch {
    return [];
  }
}

// ── 백업 내보내기·불러오기 ─────────────────────────────────

export interface BackupFile {
  format: 'worksheet-creator-backup';
  version: 1;
  exportedAt: number;
  works: Work[];
}

export function buildBackup(works: Work[]): BackupFile {
  return { format: 'worksheet-creator-backup', version: 1, exportedAt: Date.now(), works: works.map((w) => structuredClone(w)) };
}

export type ParseBackupResult = { ok: true; works: Work[] } | { ok: false; reason: string };

/** 백업 파일을 검사해 불러온다. 잘못된 파일은 이유와 함께 거부한다. */
export function parseBackup(text: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'JSON 형식이 아니에요. 올바른 백업 파일인지 확인해 주세요.' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: '백업 파일 구조가 올바르지 않아요.' };
  const b = parsed as Record<string, unknown>;
  if (b.format !== 'worksheet-creator-backup') return { ok: false, reason: '이 파일은 학습지 제작 도구의 백업 파일이 아니에요.' };
  if (b.version !== 1) return { ok: false, reason: `지원하지 않는 백업 버전이에요(${String(b.version)}). 이 앱은 버전 1을 읽어요.` };
  if (!Array.isArray(b.works) || b.works.length === 0) return { ok: false, reason: '백업에 작업이 없어요.' };
  const works: Work[] = [];
  for (const w of b.works) {
    const clean = sanitizeWork(w);
    if (!clean) return { ok: false, reason: '백업 안의 작업 하나가 손상되어 있어요. 파일을 확인해 주세요.' };
    works.push(clean);
  }
  return { ok: true, works };
}

/** 불러온 작업을 기존 문서에 안전하게 추가한다: 절대 기존 작업을 덮어쓰지 않는다.
 *  작업 id 가 충돌하면 새 id 로 복사해 추가한다(지시서 §12.4). */
export function mergeImported(doc: CreatorDoc, imported: Work[]): { doc: CreatorDoc; added: number; renamed: number } {
  const existing = new Set(doc.works.map((w) => w.id));
  const works = [...doc.works];
  let renamed = 0;
  for (const w of imported) {
    let copy = structuredClone(w);
    if (existing.has(copy.id)) {
      copy = { ...copy, id: uid('w') };
      renamed += 1;
    }
    existing.add(copy.id);
    works.push(copy);
  }
  return { doc: { ...doc, works }, added: imported.length, renamed };
}

/** 손상된 원본을 사용자가 내려받을 수 있게 파일로 저장한다. */
export function downloadCorruptBackup(raw: string): void {
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `worksheet-creator-corrupt-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 백업 파일을 내려받는다. */
export function downloadBackup(backup: BackupFile, filename: string): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

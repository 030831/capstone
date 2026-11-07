// 최상위 앱 상태(useReducer).
// v3(2026-11-07): ① 상태 4종(unknown=기록 없음, 명시적 not_started 보존)
// ② IEP 초안은 미리 보기만 하고 applyIepChanges 로 선택 항목만 적용(1회 되돌리기)
// ③ 문제 초안에 confirmed(개념 확정) 추가 — 확정 전에는 검사 실행 불가
// ④ 저장 형식 v2: 학생 상태·현재 학생·작성 중 문제·확정 개념·표면 속성 복원.
// 저장 실패는 조용히 무시하지 않는다(saveStored 가 false 를 반환, App 이 안내 표시).
import { EMPTY_SURFACE, SAMPLE_PROBLEMS, type Surface } from './data/problems';
import { makePresets, type Student } from './data/students';
import { hardAncestors, type State, type States } from './engine';
import { graph } from './graph';

export type ModalKey = 'none' | 'students' | 'batch';

export interface Draft {
  text: string;
  requires: string[];
  /** 교사가 "이 개념으로 검사한다"고 확인했는지. text/requires 가 바뀌면 다시 확인 필요. */
  confirmed: boolean;
  surface: Surface;
}

export interface AppState {
  students: Student[];
  currentId: string;
  draft: Draft;
  /** "검사"를 누른 시점의 확정된 문제 스냅샷. null 이면 아직 검사 전.
   *  draft 가 이후에 바뀌어도 유지되며, 화면에서는 "이전 입력의 결과"로 표시된다. */
  submitted: { text: string; requires: string[] } | null;
  /** IEP 적용 직전 스냅샷(최근 1회 되돌리기용). 저장하지 않는다. */
  lastApplyUndo: { studentId: string; states: States } | null;
  /** 헤더 버튼으로 여는 보조 화면(모달). 메인은 항상 문제 검사 위저드. */
  modal: ModalKey;
}

export type Action =
  | { type: 'selectStudent'; id: string }
  | { type: 'setNodeState'; node: string; state: State }
  | { type: 'applyIepChanges'; changes: { node: string; state: State }[] }
  | { type: 'undoIepApply' }
  | { type: 'addStudent' }
  | { type: 'deleteStudent'; id: string }
  | { type: 'resetPresets' }
  | { type: 'setDraft'; draft: Partial<Draft> }
  | { type: 'confirmConcepts' }
  | { type: 'loadSample'; sampleId: string }
  | { type: 'submit' }
  | { type: 'openModal'; modal: ModalKey }
  | { type: 'closeModal' }
  | { type: 'openStudentResult'; id: string; text: string; requires: string[] };

export const STORAGE_KEY = 'alignment-checker-v0:students';
const STORAGE_VERSION = 2;
const VALID_STATES: ReadonlySet<string> = new Set(['unknown', 'not_started', 'emerging', 'mastered']);

export function initialStudents(): Student[] {
  return makePresets(graph.nodeIds);
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export interface StoredDraft {
  text: string;
  requires: string[];
  confirmed: boolean;
  surface: Surface;
}

/** localStorage 에서 저장된 상태를 읽는다. 실패·손상·형식 불일치는 null(프리셋 사용).
 *  v1(학생만 저장)도 읽을 수 있다 — 빠진 항목은 unknown 으로 이전하고 초안은 복원하지 않는다. */
export function loadStored(): { students: Student[]; currentId: string; draft: StoredDraft | null } | null {
  try {
    const storage = safeStorage();
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      version?: unknown;
      students?: unknown;
      currentId?: unknown;
      draft?: unknown;
    };
    if (!Array.isArray(data.students) || data.students.length === 0) return null;
    const students: Student[] = [];
    for (const s of data.students as Student[]) {
      if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.states !== 'object' || !s.states) return null;
      const states: States = {};
      for (const [k, v] of Object.entries(s.states)) {
        if (graph.labels.has(k) && typeof v === 'string' && VALID_STATES.has(v)) states[k] = v as State;
      }
      students.push({ id: s.id, name: s.name, states });
    }
    const currentId = students.some((s) => s.id === data.currentId) ? (data.currentId as string) : students[0].id;

    let draft: StoredDraft | null = null;
    if (data.version === STORAGE_VERSION && data.draft && typeof data.draft === 'object') {
      const d = data.draft as Partial<StoredDraft>;
      if (typeof d.text === 'string' && Array.isArray(d.requires) && typeof d.confirmed === 'boolean' && d.surface && typeof d.surface === 'object') {
        const requires = d.requires.filter((x): x is string => typeof x === 'string' && graph.labels.has(x));
        draft = {
          text: d.text,
          requires,
          confirmed: d.confirmed && requires.length > 0,
          surface: {
            numberRange: String(d.surface.numberRange ?? ''),
            context: String(d.surface.context ?? ''),
            representation: String(d.surface.representation ?? ''),
            support: String(d.surface.support ?? ''),
          },
        };
      }
    }
    return { students, currentId, draft };
  } catch {
    return null; // 손상된 저장 데이터 — 앱은 계속 동작한다(프리셋으로 시작)
  }
}

/** 앱 상태를 localStorage 에 저장한다. 성공 여부를 반환한다(실패를 숨기지 않는다). */
export function saveStored(students: Student[], currentId: string, draft: Draft): boolean {
  try {
    const storage = safeStorage();
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      students,
      currentId,
      draft: { text: draft.text, requires: draft.requires, confirmed: draft.confirmed, surface: draft.surface },
    }));
    return true;
  } catch {
    return false; // 시크릿 모드 등 저장 불가 환경
  }
}

export function emptyDraft(): Draft {
  return { text: '', requires: [], confirmed: false, surface: { ...EMPTY_SURFACE } };
}

export function initState(): AppState {
  const stored = loadStored();
  const students = stored?.students ?? initialStudents();
  const draft: Draft = stored?.draft
    ? { ...stored.draft, surface: { ...stored.draft.surface } }
    : emptyDraft();
  return {
    students,
    currentId: stored?.currentId ?? students[0].id,
    draft,
    submitted: null,
    lastApplyUndo: null,
    modal: 'none',
  };
}

/** 익명 ID: 학생 D, E, ... Z, 이후 학생 27, 28 ... (이미 쓰인 이름은 건너뜀). */
function nextStudentName(students: Student[]): { id: string; name: string } {
  const used = new Set(students.map((s) => s.id));
  for (let i = 0; i < 26; i++) {
    const c = String.fromCharCode(65 + i);
    if (!used.has(c)) return { id: c, name: `학생 ${c}` };
  }
  let n = 27;
  while (used.has(String(n))) n++;
  return { id: String(n), name: `학생 ${n}` };
}

function reduceCore(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'selectStudent':
      return { ...s, currentId: a.id };
    case 'setNodeState':
      return {
        ...s,
        students: s.students.map((st) => {
          if (st.id !== s.currentId) return st;
          const states = { ...st.states };
          if (a.state === 'unknown') delete states[a.node]; // 미확인 = 기록 없음
          else states[a.node] = a.state; // 명시적 not_started 는 지우지 않는다
          return { ...st, states };
        }),
      };
    case 'applyIepChanges': {
      // 미리 보기에서 교사가 선택한 항목만 현재 학생에 적용한다(적용 전 스냅샷 저장).
      if (a.changes.length === 0) return s;
      return {
        ...s,
        lastApplyUndo: { studentId: s.currentId, states: { ...(s.students.find((st) => st.id === s.currentId)?.states ?? {}) } },
        students: s.students.map((st) => {
          if (st.id !== s.currentId) return st;
          const states = { ...st.states };
          for (const c of a.changes) {
            if (c.state === 'unknown') delete states[c.node];
            else states[c.node] = c.state;
          }
          return { ...st, states };
        }),
      };
    }
    case 'undoIepApply': {
      const snap = s.lastApplyUndo;
      if (!snap) return s;
      return {
        ...s,
        lastApplyUndo: null,
        students: s.students.map((st) => (st.id === snap.studentId ? { ...st, states: { ...snap.states } } : st)),
      };
    }
    case 'addStudent': {
      const n = nextStudentName(s.students);
      return { ...s, students: [...s.students, { ...n, states: {} }], currentId: n.id };
    }
    case 'deleteStudent': {
      if (s.students.length <= 1) return s;
      const students = s.students.filter((x) => x.id !== a.id);
      const undo = s.lastApplyUndo && s.lastApplyUndo.studentId === a.id ? null : s.lastApplyUndo;
      return { ...s, students, currentId: s.currentId === a.id ? students[0].id : s.currentId, lastApplyUndo: undo };
    }
    case 'resetPresets': {
      const students = initialStudents();
      return { ...s, students, currentId: students[0].id, lastApplyUndo: null };
    }
    case 'setDraft': {
      const d = { ...s.draft, ...a.draft };
      // 문제 글·개념이 바뀌면 이전 개념 확인을 무효화한다(표면 속성은 무효화하지 않는다).
      if ('text' in a.draft || 'requires' in a.draft) d.confirmed = false;
      return { ...s, draft: d };
    }
    case 'confirmConcepts':
      if (s.draft.requires.length === 0) return s;
      return { ...s, draft: { ...s.draft, confirmed: true } };
    case 'loadSample': {
      const p = SAMPLE_PROBLEMS.find((x) => x.id === a.sampleId);
      if (!p) return s;
      return {
        ...s,
        draft: { text: p.text, requires: [...p.requires], confirmed: false, surface: { ...p.surface } },
      };
    }
    case 'submit':
      // 확정되지 않은 문제·개념은 검사하지 않는다(단일 검사·반 검사 공통).
      if (!s.draft.confirmed || s.draft.requires.length === 0 || !s.draft.text.trim()) return s;
      return { ...s, submitted: { text: s.draft.text, requires: [...s.draft.requires] } };
    case 'openModal':
      return { ...s, modal: a.modal };
    case 'closeModal':
      return { ...s, modal: 'none' };
    case 'openStudentResult':
      return {
        ...s,
        currentId: a.id,
        modal: 'none',
        draft: { ...s.draft, text: a.text, requires: [...a.requires], confirmed: true },
        submitted: { text: a.text, requires: [...a.requires] },
      };
  }
}

/** 선수까지 숙달 미리 보기용: 이 개념과 그 hard 선수 중 아직 숙달이 아닌 노드 목록. */
export function prereqMasteryTargets(node: string, states: States): string[] {
  const ids = [node, ...hardAncestors(graph, [node])];
  return ids.filter((id) => states[id] !== 'mastered').sort((a, b) => a.localeCompare(b));
}

export const reducer = reduceCore;

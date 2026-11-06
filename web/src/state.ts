// 최상위 앱 상태(useReducer).
// v1: 탭 없이 단일 메인 페이지(문제 검사 위저드) + 헤더 버튼 2개(학생 관리·반 일괄)로 모달.
// 그래프 관련 상태(highlight/selectedNode/focusRequest/showFringe)는 제거됨 — ComfyUI 형태 오해 원천.
import { EMPTY_SURFACE, SAMPLE_PROBLEMS, type Surface } from './data/problems';
import { makePresets, type Student } from './data/students';
import { hardAncestors, type State } from './engine';
import { graph } from './graph';

export type ModalKey = 'none' | 'students' | 'batch';

export interface Draft {
  text: string;
  requires: string[];
  surface: Surface;
}

export interface AppState {
  students: Student[];
  currentId: string;
  draft: Draft;
  /** "검사"를 누른 시점의 문제. null 이면 아직 검사 전. */
  submitted: { text: string; requires: string[] } | null;
  /** 헤더 버튼으로 여는 보조 화면(모달). 메인은 항상 문제 검사 위저드. */
  modal: ModalKey;
}

export type Action =
  | { type: 'selectStudent'; id: string }
  | { type: 'setNodeState'; node: string; state: State }
  | { type: 'masterWithPrereqs'; node: string }
  | { type: 'addStudent' }
  | { type: 'deleteStudent'; id: string }
  | { type: 'resetPresets' }
  | { type: 'setDraft'; draft: Partial<Draft> }
  | { type: 'loadSample'; sampleId: string }
  | { type: 'submit' }
  | { type: 'openModal'; modal: ModalKey }
  | { type: 'closeModal' }
  | { type: 'openStudentResult'; id: string; text: string; requires: string[] };

export const STORAGE_KEY = 'alignment-checker-v0:students';

export function initialStudents(): Student[] {
  return makePresets(graph.nodeIds);
}

/** localStorage 에서 학생 목록을 읽는다. 실패하거나 형식이 다르면 null(프리셋 사용). */
export function loadStored(): { students: Student[]; currentId: string } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { students?: unknown; currentId?: unknown };
    if (!Array.isArray(data.students) || data.students.length === 0) return null;
    const valid = new Set<string>(['mastered', 'emerging', 'not_started']);
    const students: Student[] = [];
    for (const s of data.students as Student[]) {
      if (!s || typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.states !== 'object' || !s.states) return null;
      const states: Student['states'] = {};
      for (const [k, v] of Object.entries(s.states)) {
        if (graph.labels.has(k) && valid.has(v)) states[k] = v;
      }
      students.push({ id: s.id, name: s.name, states });
    }
    const currentId = students.some((s) => s.id === data.currentId) ? (data.currentId as string) : students[0].id;
    return { students, currentId };
  } catch {
    return null;
  }
}

export function saveStored(students: Student[], currentId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ students, currentId }));
  } catch {
    /* 저장소를 못 쓰는 환경(시크릿 모드 등)에서도 앱은 동작해야 한다. */
  }
}

export function initState(): AppState {
  const stored = loadStored();
  const students = stored?.students ?? initialStudents();
  return {
    students,
    currentId: stored?.currentId ?? students[0].id,
    draft: { text: '', requires: [], surface: { ...EMPTY_SURFACE } },
    submitted: null,
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
          if (a.state === 'not_started') delete states[a.node];
          else states[a.node] = a.state;
          return { ...st, states };
        }),
      };
    case 'masterWithPrereqs': {
      // 이 개념과 모든 필수(hard) 선수 개념을 숙달로 표시한다 (하향 폐쇄 유지).
      const ids = new Set<string>([a.node, ...hardAncestors(graph, [a.node])]);
      return {
        ...s,
        students: s.students.map((st) => {
          if (st.id !== s.currentId) return st;
          const states = { ...st.states };
          for (const id of ids) states[id] = 'mastered';
          return { ...st, states };
        }),
      };
    }
    case 'addStudent': {
      const n = nextStudentName(s.students);
      return { ...s, students: [...s.students, { ...n, states: {} }], currentId: n.id };
    }
    case 'deleteStudent': {
      if (s.students.length <= 1) return s;
      const students = s.students.filter((x) => x.id !== a.id);
      return { ...s, students, currentId: s.currentId === a.id ? students[0].id : s.currentId };
    }
    case 'resetPresets': {
      const students = initialStudents();
      return { ...s, students, currentId: students[0].id };
    }
    case 'setDraft':
      return { ...s, draft: { ...s.draft, ...a.draft } };
    case 'loadSample': {
      const p = SAMPLE_PROBLEMS.find((x) => x.id === a.sampleId);
      if (!p) return s;
      return { ...s, draft: { text: p.text, requires: [...p.requires], surface: { ...p.surface } }, submitted: null };
    }
    case 'submit':
      if (s.draft.requires.length === 0) return s;
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
        draft: { ...s.draft, text: a.text, requires: [...a.requires] },
        submitted: { text: a.text, requires: [...a.requires] },
      };
  }
}

export const reducer = reduceCore;

// 편집 상태(useReducer) — 실행 취소·다시 실행 포함 (지시서 §12.5).
// 편집 이력은 버전(공통/학생별)별로 분리한다. 버전을 바꾼 뒤 취소해도
// 다른 버전의 편집이 취소되지 않는다. 되돌리기가 이후 변경까지 지우지 않게
// 스냅샷(문제+순서) 방식을 쓴다.
// id 생성은 컴포넌트(이벤트 핸들러)에서 미리 해 리듀서를 순수하게 유지한다.
import { defaultChoices } from './answers';
import { makeProblem } from './defaults';
import type { CreatorDoc, Problem, ProblemKind, ProblemSet, StudentRef, VersionKey, Work } from './types';
import { clone, uid } from './util';

export type View =
  | { screen: 'works' }
  | { screen: 'editor'; workId: string }
  | { screen: 'worksheet'; workId: string; version: string };

export interface HistoryEntry {
  problems: Record<string, Problem>;
  order: string[];
  /** 같은 키의 연속 편집을 한 되돌리기 단계로 묶는다(문장 타이핑 등). */
  coalesceKey?: string;
}

export interface VersionHistory {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export interface CreatorState {
  doc: CreatorDoc;
  view: View;
  /** `${workId}|${version}` -> 이력. 저장하지 않는다(세션 동안만). */
  history: Record<string, VersionHistory>;
}

export type Action =
  | { type: 'createWork'; work: Work }
  | { type: 'openWork'; workId: string }
  | { type: 'closeWork' }
  | { type: 'openWorksheet'; workId: string; version: string }
  | { type: 'renameWork'; workId: string; name: string }
  | { type: 'deleteWork'; workId: string }
  | { type: 'addProblem'; workId: string; kind: ProblemKind }
  | { type: 'updateProblem'; workId: string; problemId: string; patch: Partial<Problem>; coalesceKey?: string }
  | { type: 'deleteProblem'; workId: string; problemId: string }
  | { type: 'duplicateProblem'; workId: string; problemId: string }
  | { type: 'moveProblem'; workId: string; problemId: string; dir: -1 | 1 }
  | { type: 'selectProblem'; workId: string; problemId: string | null }
  | { type: 'setVersion'; workId: string; version: VersionKey }
  | { type: 'addStudent'; workId: string; student: StudentRef }
  | { type: 'updateStudent'; workId: string; studentId: string; patch: Partial<StudentRef> }
  | { type: 'removeStudent'; workId: string; studentId: string }
  | { type: 'importLegacyStudents'; workId: string; students: { id: string; name: string }[] }
  | { type: 'createStudentVersion'; workId: string; studentId: string }
  | { type: 'deleteStudentVersion'; workId: string; studentId: string }
  | { type: 'setWorksheetTitle'; workId: string; title: string }
  | { type: 'undo'; workId: string; version: VersionKey }
  | { type: 'redo'; workId: string; version: VersionKey }
  | { type: 'importWorks'; works: Work[] };

const historyKey = (workId: string, version: VersionKey): string => `${workId}|${version}`;

function snapshot(set: ProblemSet, coalesceKey?: string): HistoryEntry {
  return { problems: clone(set.problems), order: [...set.order], coalesceKey };
}

/** 버전의 세트에 변경을 가하기 전 이력을 남긴다. 순수 함수. */
function withHistory(
  state: CreatorState,
  workId: string,
  version: VersionKey,
  set: ProblemSet,
  coalesceKey?: string,
): Pick<CreatorState, 'history'> {
  const key = historyKey(workId, version);
  const h = state.history[key] ?? { past: [], future: [] };
  const top = h.past[h.past.length - 1];
  // 같은 coalesceKey 연속 편집이면 이미 '처음 이전' 상태가 top 에 있으므로 다시 쌓지 않는다.
  const skip = coalesceKey !== undefined && top?.coalesceKey === coalesceKey;
  const past = skip ? h.past : [...h.past, snapshot(set, coalesceKey)];
  return { history: { ...state.history, [key]: { past, future: [] } } };
}

function mapWork(doc: CreatorDoc, workId: string, fn: (w: Work) => Work): CreatorDoc {
  return { ...doc, works: doc.works.map((w) => (w.id === workId ? fn(w) : w)) };
}

function mapSet(work: Work, version: VersionKey, fn: (set: ProblemSet) => ProblemSet): Work {
  if (version === 'common') return { ...work, common: fn(work.common), updatedAt: Date.now() };
  if (!work.studentSets[version]) return work;
  return { ...work, studentSets: { ...work.studentSets, [version]: fn(work.studentSets[version]) }, updatedAt: Date.now() };
}

function fixSelection(work: Work, version: VersionKey): Work {
  const set = version === 'common' ? work.common : work.studentSets[version];
  if (!set) return { ...work, selectedVersion: 'common', selectedProblemId: work.common.order[0] ?? null };
  const sel = work.selectedProblemId && set.problems[work.selectedProblemId] ? work.selectedProblemId : set.order[0] ?? null;
  return { ...work, selectedProblemId: sel };
}

/** 학생별 버전 생성: 공통 세트를 깊은 복사해 **모든 문제에 새 id** 를 준다(독립성, 지시서 §10.3). */
export function cloneSetWithNewIds(set: ProblemSet): ProblemSet {
  const problems: Record<string, Problem> = {};
  const order: string[] = [];
  for (const id of set.order) {
    const p = clone(set.problems[id]);
    p.id = uid('p');
    problems[p.id] = p;
    order.push(p.id);
  }
  return { problems, order };
}

/** 응답 방식을 답칸↔선택지로 바꾼다. 선택지가 비었으면 기본 선택지(수정 가능한 시작값)를 채운다. */
export function withResponseMode(p: Problem, mode: 'blank' | 'choices'): Problem {
  if (mode === 'blank') return { ...p, response: { ...p.response, mode } };
  if (p.response.mode === 'choices' && p.response.choices.length > 0) return { ...p, response: { ...p.response, mode } };
  const { choices, correctIndex } = defaultChoices(p);
  return { ...p, response: { ...p.response, mode, choices, correctIndex } };
}

export function creatorReducer(state: CreatorState, action: Action): CreatorState {
  switch (action.type) {
    case 'createWork': {
      const doc: CreatorDoc = { ...state.doc, works: [...state.doc.works, action.work] };
      return { ...state, doc, view: { screen: 'editor', workId: action.work.id } };
    }
    case 'openWork': {
      if (!state.doc.works.some((w) => w.id === action.workId)) return state;
      const doc = { ...state.doc, lastOpenedWorkId: action.workId };
      return { ...state, doc, view: { screen: 'editor', workId: action.workId } };
    }
    case 'closeWork':
      return { ...state, view: { screen: 'works' } };
    case 'openWorksheet':
      return { ...state, view: { screen: 'worksheet', workId: action.workId, version: action.version } };
    case 'renameWork':
      return { ...state, doc: mapWork(state.doc, action.workId, (w) => ({ ...w, name: action.name, updatedAt: Date.now() })) };
    case 'deleteWork': {
      const works = state.doc.works.filter((w) => w.id !== action.workId);
      const lastOpenedWorkId = state.doc.lastOpenedWorkId === action.workId ? null : state.doc.lastOpenedWorkId;
      const history = { ...state.history };
      for (const k of Object.keys(history)) if (k.startsWith(`${action.workId}|`)) delete history[k];
      const view: View = state.view.screen !== 'works' && state.view.workId === action.workId ? { screen: 'works' } : state.view;
      return { ...state, doc: { ...state.doc, works, lastOpenedWorkId }, history, view };
    }
    case 'setWorksheetTitle':
      return { ...state, doc: mapWork(state.doc, action.workId, (w) => ({ ...w, worksheetTitle: action.title, updatedAt: Date.now() })) };

    // ── 문제 편집 (이력 대상) ──
    case 'addProblem': {
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work) return state;
      const p = makeProblem(action.kind);
      const version = work.selectedVersion;
      const doc = mapWork(state.doc, action.workId, (w) =>
        mapSet(w, version, (set) => ({ problems: { ...set.problems, [p.id]: p }, order: [...set.order, p.id] })),
      );
      const withSel = mapWork(doc, action.workId, (w) => ({ ...w, selectedProblemId: p.id }));
      const before = version === 'common' ? work.common : work.studentSets[version];
      const key = historyKey(action.workId, version);
      const h = state.history[key] ?? { past: [], future: [] };
      return {
        ...state,
        doc: withSel,
        history: { ...state.history, [key]: { past: [...h.past, snapshot(before)], future: [] } },
      };
    }
    case 'updateProblem': {
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work) return state;
      const version = work.selectedVersion;
      const set = version === 'common' ? work.common : work.studentSets[version];
      if (!set || !set.problems[action.problemId]) return state;
      const doc = mapWork(state.doc, action.workId, (w) =>
        mapSet(w, version, (s) => ({
          ...s,
          problems: { ...s.problems, [action.problemId]: { ...(s.problems[action.problemId] as Problem), ...action.patch } as Problem },
        })),
      );
      return { ...state, doc, ...withHistory(state, action.workId, version, set, action.coalesceKey) };
    }
    case 'deleteProblem': {
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work) return state;
      const version = work.selectedVersion;
      const set = version === 'common' ? work.common : work.studentSets[version];
      if (!set || !set.problems[action.problemId]) return state;
      const doc = mapWork(state.doc, action.workId, (w) => {
        const next = mapSet(w, version, (s) => {
          const problems = { ...s.problems };
          delete problems[action.problemId];
          return { problems, order: s.order.filter((id) => id !== action.problemId) };
        });
        return { ...next, selectedProblemId: next.selectedProblemId === action.problemId ? next.common.order[0] ?? null : next.selectedProblemId };
      });
      const key = historyKey(action.workId, version);
      const h = state.history[key] ?? { past: [], future: [] };
      return { ...state, doc, history: { ...state.history, [key]: { past: [...h.past, snapshot(set)], future: [] } } };
    }
    case 'duplicateProblem': {
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work) return state;
      const version = work.selectedVersion;
      const set = version === 'common' ? work.common : work.studentSets[version];
      if (!set || !set.problems[action.problemId]) return state;
      const src = set.problems[action.problemId];
      const copy = clone(src);
      copy.id = uid('p'); // 독립 ID — 한쪽을 수정해도 다른 쪽이 바뀌지 않는다.
      const idx = set.order.indexOf(action.problemId);
      const order = [...set.order];
      order.splice(idx + 1, 0, copy.id);
      const doc = mapWork(state.doc, action.workId, (w) =>
        mapSet(w, version, (s) => ({ problems: { ...s.problems, [copy.id]: copy }, order })),
      );
      const withSel = mapWork(doc, action.workId, (w) => ({ ...w, selectedProblemId: copy.id }));
      const key = historyKey(action.workId, version);
      const h = state.history[key] ?? { past: [], future: [] };
      return { ...state, doc: withSel, history: { ...state.history, [key]: { past: [...h.past, snapshot(set)], future: [] } } };
    }
    case 'moveProblem': {
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work) return state;
      const version = work.selectedVersion;
      const set = version === 'common' ? work.common : work.studentSets[version];
      if (!set) return state;
      const i = set.order.indexOf(action.problemId);
      const j = i + action.dir;
      if (i < 0 || j < 0 || j >= set.order.length) return state;
      const order = [...set.order];
      [order[i], order[j]] = [order[j], order[i]];
      const doc = mapWork(state.doc, action.workId, (w) => mapSet(w, version, (s) => ({ ...s, order })));
      return { ...state, doc, ...withHistory(state, action.workId, version, set) };
    }
    case 'selectProblem':
      return { ...state, doc: mapWork(state.doc, action.workId, (w) => ({ ...w, selectedProblemId: action.problemId })) };
    case 'setVersion': {
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work) return state;
      const exists = action.version === 'common' || work.studentSets[action.version];
      if (!exists) return state;
      const doc = mapWork(state.doc, action.workId, (w) => fixSelection({ ...w, selectedVersion: action.version }, action.version));
      return { ...state, doc };
    }

    // ── 학생 참고 정보 ──
    case 'addStudent':
      return { ...state, doc: mapWork(state.doc, action.workId, (w) => ({ ...w, students: [...w.students, action.student], updatedAt: Date.now() })) };
    case 'updateStudent':
      return {
        ...state,
        doc: mapWork(state.doc, action.workId, (w) => ({
          ...w,
          students: w.students.map((s) => (s.id === action.studentId ? { ...s, ...action.patch } : s)),
          updatedAt: Date.now(),
        })),
      };
    case 'removeStudent': {
      // 학생 정보 삭제: 참고 정보와 그 학생의 버전을 함께 지운다(확인 문구에서 고지).
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work || !work.students.some((s) => s.id === action.studentId)) return state;
      const studentSets = { ...work.studentSets };
      delete studentSets[action.studentId];
      const history = { ...state.history };
      delete history[historyKey(action.workId, action.studentId)];
      const selectedVersion = work.selectedVersion === action.studentId ? 'common' : work.selectedVersion;
      return {
        ...state,
        history,
        doc: mapWork(state.doc, action.workId, (w) => ({
          ...w,
          students: w.students.filter((s) => s.id !== action.studentId),
          studentSets,
          selectedVersion,
          updatedAt: Date.now(),
        })),
      };
    }
    case 'importLegacyStudents': {
      // 기존 검사기 학생을 **표시 이름만** 가져온다(숙달 상태 번역 없음 — 지시서 §4.2).
      const existing = new Set(
        state.doc.works
          .find((w) => w.id === action.workId)
          ?.students.map((s) => s.linkedOldId ?? `#${s.displayName}`) ?? [],
      );
      const adding = action.students.filter((s) => !existing.has(s.id));
      if (adding.length === 0) return state;
      const students = adding.map((s) => ({ id: uid('s'), displayName: s.name, iepGoal: '', supportNote: '', linkedOldId: s.id }));
      return { ...state, doc: mapWork(state.doc, action.workId, (w) => ({ ...w, students: [...w.students, ...students], updatedAt: Date.now() })) };
    }
    case 'createStudentVersion': {
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work || !work.students.some((s) => s.id === action.studentId)) return state;
      const set = cloneSetWithNewIds(work.common);
      const history = { ...state.history };
      delete history[historyKey(action.workId, action.studentId)]; // 새 버전은 깨끗한 이력으로 시작
      return {
        ...state,
        history,
        doc: mapWork(state.doc, action.workId, (w) => ({
          ...w,
          studentSets: { ...w.studentSets, [action.studentId]: set },
          selectedVersion: action.studentId,
          selectedProblemId: set.order[0] ?? null,
          updatedAt: Date.now(),
        })),
      };
    }
    case 'deleteStudentVersion': {
      // 버전만 삭제: 학생 참고 정보는 남는다(지시서 §10.5).
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work || !work.studentSets[action.studentId]) return state;
      const studentSets = { ...work.studentSets };
      delete studentSets[action.studentId];
      const history = { ...state.history };
      delete history[historyKey(action.workId, action.studentId)];
      const selectedVersion = work.selectedVersion === action.studentId ? 'common' : work.selectedVersion;
      const doc = mapWork(state.doc, action.workId, (w) => ({ ...w, studentSets, selectedVersion, updatedAt: Date.now() }));
      return { ...state, history, doc: mapWork(doc, action.workId, (w) => fixSelection(w, selectedVersion)) };
    }

    // ── 실행 취소·다시 실행 (버전별) ──
    case 'undo': {
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work || work.selectedVersion !== action.version) return state;
      const key = historyKey(action.workId, action.version);
      const h = state.history[key];
      if (!h || h.past.length === 0) return state;
      const set = action.version === 'common' ? work.common : work.studentSets[action.version];
      const restore = h.past[h.past.length - 1];
      const past = h.past.slice(0, -1);
      const future = [...h.future, snapshot(set)];
      const doc = mapWork(state.doc, action.workId, (w) => {
        const next = mapSet(w, action.version, () => ({ problems: restore.problems, order: [...restore.order] }));
        return { ...next, selectedProblemId: next.selectedProblemId && restore.problems[next.selectedProblemId] ? next.selectedProblemId : restore.order[0] ?? null };
      });
      return { ...state, doc, history: { ...state.history, [key]: { past, future } } };
    }
    case 'redo': {
      const work = state.doc.works.find((w) => w.id === action.workId);
      if (!work || work.selectedVersion !== action.version) return state;
      const key = historyKey(action.workId, action.version);
      const h = state.history[key];
      if (!h || h.future.length === 0) return state;
      const set = action.version === 'common' ? work.common : work.studentSets[action.version];
      const restore = h.future[h.future.length - 1];
      const future = h.future.slice(0, -1);
      const past = [...h.past, snapshot(set)];
      const doc = mapWork(state.doc, action.workId, (w) => {
        const next = mapSet(w, action.version, () => ({ problems: restore.problems, order: [...restore.order] }));
        return { ...next, selectedProblemId: next.selectedProblemId && restore.problems[next.selectedProblemId] ? next.selectedProblemId : restore.order[0] ?? null };
      });
      return { ...state, doc, history: { ...state.history, [key]: { past, future } } };
    }

    case 'importWorks': {
      const existing = new Set(state.doc.works.map((w) => w.id));
      const works = [...state.doc.works];
      for (const w of action.works) {
        const copy = structuredClone(w);
        if (existing.has(copy.id)) copy.id = uid('w'); // 충돌 시 새 작업으로 복사해 추가
        existing.add(copy.id);
        works.push(copy);
      }
      return { ...state, doc: { ...state.doc, works } };
    }

    default:
      return state;
  }
}

export function canUndo(state: CreatorState, workId: string, version: VersionKey): boolean {
  return (state.history[`${workId}|${version}`]?.past.length ?? 0) > 0;
}

export function canRedo(state: CreatorState, workId: string, version: VersionKey): boolean {
  return (state.history[`${workId}|${version}`]?.future.length ?? 0) > 0;
}

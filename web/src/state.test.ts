// @vitest-environment jsdom
// state.ts 리듀서·localStorage 저장 테스트 (지시서 §4·§8 검증 항목).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { graph } from './graph';
import {
  emptyDraft,
  initState,
  loadStored,
  reducer,
  saveStored,
  STORAGE_KEY,
  type Action,
  type AppState,
} from './state';
import { makePresets, STUDENT_A_STATES } from './data/students';

const N16 = 'N16_ten_complements';
const N26 = 'N26_add_single_digit_carry';
const N39 = 'N39_mult_table';

const start = (): AppState => initState();
const dispatch = (s: AppState, a: Action): AppState => reducer(s, a);

afterEach(() => {
  window.localStorage.clear();
});

describe('상태 모델: 미확인과 미시작 구분 (§3)', () => {
  it('기록에 없는 개념은 미확인(unknown)이며 명시적 미시작은 지우지 않는다', () => {
    let s = start();
    s = dispatch(s, { type: 'setNodeState', node: N39, state: 'not_started' });
    expect(s.students[0].states[N39]).toBe('not_started'); // 명시적 미시작 보존
    s = dispatch(s, { type: 'setNodeState', node: N39, state: 'unknown' });
    expect(s.students[0].states[N39]).toBeUndefined(); // 미확인 = 기록 없음
  });

  it('프리셋 학생 A 에는 명시적 미시작(받아올림)이 기록되어 있다', () => {
    expect(STUDENT_A_STATES[N26]).toBe('not_started');
  });
});

describe('IEP 미리 보기·적용·되돌리기 (§4)', () => {
  it('applyIepChanges 는 선택한 항목만 현재 학생에 적용한다', () => {
    let s = start();
    const before = { ...s.students[0].states };
    s = dispatch(s, {
      type: 'applyIepChanges',
      changes: [
        { node: N39, state: 'mastered' },
        { node: N16, state: 'not_started' },
      ],
    });
    expect(s.students[0].states[N39]).toBe('mastered');
    expect(s.students[0].states[N16]).toBe('not_started');
    expect(s.students[0].states.N13_count_on_from_n).toBe(before.N13_count_on_from_n); // 미선택 항목 불변
  });

  it('적용 뒤 최근 1회를 되돌릴 수 있다(두 번째 undo 는 무동작)', () => {
    let s = start();
    const before = { ...s.students[0].states };
    s = dispatch(s, { type: 'applyIepChanges', changes: [{ node: N39, state: 'mastered' }] });
    expect(s.students[0].states[N39]).toBe('mastered');
    s = dispatch(s, { type: 'undoIepApply' });
    expect(s.students[0].states).toEqual(before);
    const afterUndo = dispatch(s, { type: 'undoIepApply' });
    expect(afterUndo).toBe(s); // 되돌릴 게 없으면 무동작
  });

  it('적용 스냅샷은 학생별로 붙는다 — 다른 학생에 적용되지 않는다', () => {
    let s = start();
    const bBefore = { ...s.students[1].states };
    s = dispatch(s, { type: 'applyIepChanges', changes: [{ node: N39, state: 'mastered' }] }); // 학생 A
    s = dispatch(s, { type: 'selectStudent', id: 'B' });
    s = dispatch(s, { type: 'applyIepChanges', changes: [{ node: N39, state: 'emerging' }] }); // 학생 B
    s = dispatch(s, { type: 'undoIepApply' });
    expect(s.students[1].states).toEqual(bBefore); // B 만 되돌아감
    expect(s.students[0].states[N39]).toBe('mastered'); // A 는 그대로
  });
});

describe('문제 초안·개념 확정·검사 조건 (§5)', () => {
  it('문제 글이나 개념이 바뀌면 확정이 풀린다(표면 속성은 유지)', () => {
    let s = start();
    s = dispatch(s, { type: 'setDraft', draft: { text: '8+5를 구하시오.', requires: [N26] } });
    s = dispatch(s, { type: 'confirmConcepts' });
    expect(s.draft.confirmed).toBe(true);
    s = dispatch(s, { type: 'setDraft', draft: { text: '8+5를 구해요.' } });
    expect(s.draft.confirmed).toBe(false);
    s = dispatch(s, { type: 'confirmConcepts' });
    s = dispatch(s, { type: 'setDraft', draft: { surface: { ...s.draft.surface, context: '사탕' } } });
    expect(s.draft.confirmed).toBe(true); // 표면 속성 변경은 확정을 유지한다
    s = dispatch(s, { type: 'setDraft', draft: { requires: [N26, N16] } });
    expect(s.draft.confirmed).toBe(false);
  });

  it('확정·글·개념이 모두 갖춰져야 검사가 실행된다', () => {
    let s = start();
    s = dispatch(s, { type: 'setDraft', draft: { text: '8+5', requires: [N26] } });
    expect(dispatch(s, { type: 'submit' }).submitted).toBeNull(); // 미확정
    s = dispatch(s, { type: 'confirmConcepts' });
    s = dispatch(s, { type: 'submit' });
    expect(s.submitted).toEqual({ text: '8+5', requires: [N26] });
    // 글이 비면 다시 확정해도 새 검사가 실행되지 않는다(이전 결과만 유지).
    s = dispatch(s, { type: 'setDraft', draft: { text: '' } });
    s = dispatch(s, { type: 'confirmConcepts' });
    s = dispatch(s, { type: 'submit' });
    expect(s.submitted).toEqual({ text: '8+5', requires: [N26] }); // 새 검사 안 됨
    // 개념이 비면 확정 자체가 안 된다.
    s = dispatch(s, { type: 'setDraft', draft: { requires: [] } });
    expect(dispatch(s, { type: 'confirmConcepts' }).draft.confirmed).toBe(false);
  });

  it('검사 후 입력을 고치면 결과는 유지되고(이전 입력), 개념이 비면 확정도 풀린다', () => {
    let s = start();
    s = dispatch(s, { type: 'setDraft', draft: { text: '8+5', requires: [N26] } });
    s = dispatch(s, { type: 'confirmConcepts' });
    s = dispatch(s, { type: 'submit' });
    s = dispatch(s, { type: 'setDraft', draft: { text: '13−5' } });
    expect(s.submitted).toEqual({ text: '8+5', requires: [N26] }); // 이전 결과 유지
    expect(s.draft.confirmed).toBe(false);
  });

  it('예시 불러오기는 확정 없이 채운다(교사 확인 필요)', () => {
    let s = start();
    s = dispatch(s, { type: 'loadSample', sampleId: 'P_carry' });
    expect(s.draft.text).toContain('사탕');
    expect(s.draft.requires).toEqual([N26]);
    expect(s.draft.confirmed).toBe(false);
  });
});

describe('저장·복원·이전·손상 허용 (§8)', () => {
  it('학생 상태·현재 학생·작성 중 문제·확정 개념·표면 속성을 복원한다', () => {
    let s = start();
    s = dispatch(s, { type: 'selectStudent', id: 'B' });
    s = dispatch(s, { type: 'setDraft', draft: { text: '13−5를 구하시오.', requires: ['N27_sub_teen_borrow'] } });
    s = dispatch(s, { type: 'confirmConcepts' });
    s = dispatch(s, { type: 'setDraft', draft: { surface: { ...s.draft.surface, context: '구슬' } } });
    s = dispatch(s, { type: 'setNodeState', node: N39, state: 'not_started' });
    expect(saveStored(s.students, s.currentId, s.draft)).toBe(true);

    const loaded = loadStored();
    expect(loaded).not.toBeNull();
    expect(loaded!.currentId).toBe('B');
    expect(loaded!.students.find((x) => x.id === 'B')!.states[N39]).toBe('not_started');
    expect(loaded!.draft).toEqual({
      text: '13−5를 구하시오.',
      requires: ['N27_sub_teen_borrow'],
      confirmed: true,
      surface: { numberRange: '', context: '구슬', representation: '', support: '' },
    });
  });

  it('새로고침(initState) 후 작성 중인 문제가 복원된다', () => {
    let s = start();
    s = dispatch(s, { type: 'setDraft', draft: { text: '3 곱하기 4', requires: [N39] } });
    s = dispatch(s, { type: 'confirmConcepts' });
    saveStored(s.students, s.currentId, s.draft);
    const s2 = initState();
    expect(s2.draft.text).toBe('3 곱하기 4');
    expect(s2.draft.requires).toEqual([N39]);
    expect(s2.draft.confirmed).toBe(true);
    expect(s2.students).toEqual(s.students); // 학생 데이터 초기화 없이 이전
  });

  it('v1 저장 형식(학생만, 버전 없음)을 이전한다 — 빠진 항목은 미확인', () => {
    const v1 = { students: makePresets(graph.nodeIds), currentId: 'A' };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(v1));
    const loaded = loadStored();
    expect(loaded).not.toBeNull();
    expect(loaded!.draft).toBeNull(); // 초안은 이전 불가 — 새로 시작
    expect(loaded!.students[0].states[N26]).toBe('not_started'); // 명시 상태 보존
  });

  it('손상된 저장 데이터로 앱이 중단되지 않는다(프리셋으로 시작)', () => {
    for (const bad of ['{broken json', '{"students": "nope"}', '[]', '{"students":[]}']) {
      window.localStorage.setItem(STORAGE_KEY, bad);
      expect(loadStored()).toBeNull();
      expect(() => initState()).not.toThrow();
      expect(initState().students.length).toBe(3);
    }
  });

  it('저장에 실패하면 false 를 반환한다(실패를 숨기지 않는다)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveStored(makePresets(graph.nodeIds), 'A', emptyDraft())).toBe(false);
    spy.mockRestore();
  });
});

// 편집 리듀서·실행 취소·독립성 테스트 (지시서 §10.3·§12.5·§17:
// 복제본의 독립성, 학생별 버전의 독립성, 실행 취소 범위, 문제 정렬).
import { describe, expect, test } from 'vitest';
import { makeEmptyWork } from './defaults';
import { canRedo, canUndo, creatorReducer, type Action, type CreatorState } from './reducer';
import type { CountProblem, Work } from './types';

function setup(work?: Work): CreatorState {
  const w = work ?? makeEmptyWork('테스트 작업');
  return {
    doc: { format: 'worksheet-creator', version: 1, works: [w], lastOpenedWorkId: null },
    view: { screen: 'editor', workId: w.id },
    history: {},
  };
}

const run = (state: CreatorState, ...actions: Action[]): CreatorState =>
  actions.reduce<CreatorState>((s, a) => creatorReducer(s, a), state);

/** 첫 번째 문제를 특정 형태로 읽는다(테스트는 형태를 알고 있다). */
function firstProblemAs<T>(state: CreatorState): T {
  const w = state.doc.works[0];
  return w.common.problems[w.common.order[0]] as T;
}

describe('문제 편집·이력 (§12.5)', () => {
  test('수량 변경 → 실행 취소로 이전 값 복원 → 다시 실행', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    const pid = s.doc.works[0].common.order[0];
    expect(firstProblemAs<CountProblem>(s).count).toBe(4);

    s = run(s, { type: 'updateProblem', workId: s.doc.works[0].id, problemId: pid, patch: { count: 7 } });
    expect(firstProblemAs<CountProblem>(s).count).toBe(7);

    s = run(s, { type: 'undo', workId: s.doc.works[0].id, version: 'common' });
    expect(firstProblemAs<CountProblem>(s).count).toBe(4);

    s = run(s, { type: 'redo', workId: s.doc.works[0].id, version: 'common' });
    expect(firstProblemAs<CountProblem>(s).count).toBe(7);
  });

  test('같은 필드 연속 타이핑은 한 번의 취소로 묶인다 (coalesce)', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    const wid = s.doc.works[0].id;
    const pid = s.doc.works[0].common.order[0];

    s = run(
      s,
      { type: 'updateProblem', workId: wid, problemId: pid, patch: { question: '그' }, coalesceKey: `q:${pid}` },
      { type: 'updateProblem', workId: wid, problemId: pid, patch: { question: '그림' }, coalesceKey: `q:${pid}` },
      { type: 'updateProblem', workId: wid, problemId: pid, patch: { question: '그림은?' }, coalesceKey: `q:${pid}` },
    );
    expect(firstProblemAs<CountProblem>(s).question).toBe('그림은?');
    expect(canUndo(s, wid, 'common')).toBe(true);

    s = run(s, { type: 'undo', workId: wid, version: 'common' });
    expect(firstProblemAs<CountProblem>(s).question).toBe('그림은 모두 몇 개인가요?'); // 타이핑 전으로 한 번에
  });

  test('다른 필드 편집은 별도의 취소 단계', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    const wid = s.doc.works[0].id;
    const pid = s.doc.works[0].common.order[0];

    s = run(
      s,
      { type: 'updateProblem', workId: wid, problemId: pid, patch: { question: 'A' }, coalesceKey: `q:${pid}` },
      { type: 'updateProblem', workId: wid, problemId: pid, patch: { count: 9 } },
      { type: 'updateProblem', workId: wid, problemId: pid, patch: { question: 'B' }, coalesceKey: `q:${pid}` },
    );
    s = run(s, { type: 'undo', workId: wid, version: 'common' }); // 'B' 되돌리기
    expect(firstProblemAs<CountProblem>(s).question).toBe('A');
    s = run(s, { type: 'undo', workId: wid, version: 'common' }); // count 되돌리기
    expect(firstProblemAs<CountProblem>(s).count).toBe(4);
    s = run(s, { type: 'undo', workId: wid, version: 'common' }); // 'A' 되돌리기
    expect(firstProblemAs<CountProblem>(s).question).toBe('그림은 모두 몇 개인가요?');
  });

  test('되돌리기가 이후 변경까지 지우지 않는다 (스냅샷 방식)', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    const wid = s.doc.works[0].id;
    const pid = s.doc.works[0].common.order[0];

    s = run(s, { type: 'updateProblem', workId: wid, problemId: pid, patch: { count: 7 } });
    const afterFirst = s;
    s = run(s, { type: 'updateProblem', workId: wid, problemId: pid, patch: { question: '바뀐 질문' } });

    // 첫 변경 '전'으로 되돌아가도 두 번째 변경 이력은 살아 있다
    s = run(s, { type: 'undo', workId: wid, version: 'common' });
    s = run(s, { type: 'undo', workId: wid, version: 'common' });
    expect(firstProblemAs<CountProblem>(s).count).toBe(4);
    expect(firstProblemAs<CountProblem>(s).question).toBe('그림은 모두 몇 개인가요?');
    expect(canRedo(s, wid, 'common')).toBe(true);
    s = run(s, { type: 'redo', workId: wid, version: 'common' });
    expect(firstProblemAs<CountProblem>(s).count).toBe(7);
    expect(afterFirst.doc.works[0].common.problems[pid].question).toBe('그림은 모두 몇 개인가요?');
  });

  test('문제 삭제 → 실행 취소로 복원', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    const wid = s.doc.works[0].id;
    const pid = s.doc.works[0].common.order[0];
    s = run(s, { type: 'updateProblem', workId: wid, problemId: pid, patch: { count: 6 } });

    s = run(s, { type: 'deleteProblem', workId: wid, problemId: pid });
    expect(s.doc.works[0].common.order).toHaveLength(0);

    s = run(s, { type: 'undo', workId: wid, version: 'common' });
    expect(s.doc.works[0].common.order).toHaveLength(1);
    const restored = firstProblemAs<CountProblem>(s);
    expect(restored.id).toBe(pid);
    expect(restored.count).toBe(6); // 삭제 전 상태 그대로
  });

  test('문제 순서 변경도 취소된다', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'equation' });
    const wid = s.doc.works[0].id;
    const [a, b] = s.doc.works[0].common.order;
    s = run(s, { type: 'moveProblem', workId: wid, problemId: b, dir: -1 });
    expect(s.doc.works[0].common.order).toEqual([b, a]);
    s = run(s, { type: 'undo', workId: wid, version: 'common' });
    expect(s.doc.works[0].common.order).toEqual([a, b]);
  });
});

describe('독립성 (§10.3)', () => {
  test('복제본 수정이 원본에 영향 없음 (독립 ID)', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    const wid = s.doc.works[0].id;
    const pid = s.doc.works[0].common.order[0];

    s = run(s, { type: 'duplicateProblem', workId: wid, problemId: pid });
    const order = s.doc.works[0].common.order;
    expect(order).toHaveLength(2);
    expect(order[1]).not.toBe(pid);

    const copyId = order[1];
    s = run(s, { type: 'updateProblem', workId: wid, problemId: copyId, patch: { count: 20, question: '복사본' } });
    const w = s.doc.works[0];
    const asCount = (id: string): CountProblem => w.common.problems[id] as CountProblem;
    expect(asCount(pid).count).toBe(4); // 원본 무변경
    expect(asCount(pid).question).toBe('그림은 모두 몇 개인가요?');
    expect(asCount(copyId).count).toBe(20);
  });

  test('학생별 버전은 공통과 독립 — A 수정이 공통·B에 영향 없음', () => {
    let s = setup();
    s = run(
      s,
      { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' },
      { type: 'addProblem', workId: s.doc.works[0].id, kind: 'two_groups' },
    );
    const wid = s.doc.works[0].id;
    const sA = { id: 'stu_a', displayName: '학생 A', iepGoal: '', supportNote: '' };
    const sB = { id: 'stu_b', displayName: '학생 B', iepGoal: '', supportNote: '' };
    s = run(s, { type: 'addStudent', workId: wid, student: sA }, { type: 'addStudent', workId: wid, student: sB });

    // 공통 문제 수정 후 버전 생성 → 버전은 그 시점 사본
    s = run(s, { type: 'updateProblem', workId: wid, problemId: s.doc.works[0].common.order[0], patch: { count: 5 } });
    s = run(s, { type: 'createStudentVersion', workId: wid, studentId: 'stu_a' });
    s = run(s, { type: 'createStudentVersion', workId: wid, studentId: 'stu_b' });

    const w = s.doc.works[0];
    const aPid = w.studentSets.stu_a.order[0];
    const bPid = w.studentSets.stu_b.order[0];
    expect((w.studentSets.stu_a.problems[aPid] as CountProblem).count).toBe(5);
    expect(aPid).not.toBe(w.common.order[0]); // 모든 복사본은 독립 ID

    // A 버전에서 수정
    s = run(s, { type: 'setVersion', workId: wid, version: 'stu_a' });
    s = run(s, { type: 'updateProblem', workId: wid, problemId: aPid, patch: { count: 9 } });
    const w2 = s.doc.works[0];
    expect((w2.studentSets.stu_a.problems[aPid] as CountProblem).count).toBe(9);
    expect((w2.common.problems[w2.common.order[0]] as CountProblem).count).toBe(5); // 공통 무변경
    expect((w2.studentSets.stu_b.problems[bPid] as CountProblem).count).toBe(5); // B 무변경

    // 공통을 나중에 수정해도 이미 만든 학생별 버전을 덮어쓰지 않는다
    s = run(s, { type: 'setVersion', workId: wid, version: 'common' });
    s = run(s, { type: 'updateProblem', workId: wid, problemId: w2.common.order[0], patch: { count: 2 } });
    const w3 = s.doc.works[0];
    expect((w3.studentSets.stu_a.problems[aPid] as CountProblem).count).toBe(9);
    expect((w3.studentSets.stu_b.problems[bPid] as CountProblem).count).toBe(5);
  });

  test('버전을 바꾼 뒤 취소해도 다른 버전 데이터를 건드리지 않는다 (버전별 이력)', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    const wid = s.doc.works[0].id;
    const sA = { id: 'stu_a', displayName: '학생 A', iepGoal: '', supportNote: '' };
    s = run(s, { type: 'addStudent', workId: wid, student: sA });
    s = run(s, { type: 'createStudentVersion', workId: wid, studentId: 'stu_a' });

    // 공통에서 편집 → 학생 버전으로 전환 → 취소 (공통 편집이 취소돼선 안 됨... 아니,
    // 버전별 이력이므로 학생 버전에는 취소할 게 없다)
    s = run(s, { type: 'setVersion', workId: wid, version: 'common' });
    s = run(s, { type: 'updateProblem', workId: wid, problemId: s.doc.works[0].common.order[0], patch: { count: 10 } });
    const commonPid = s.doc.works[0].common.order[0];

    s = run(s, { type: 'setVersion', workId: wid, version: 'stu_a' });
    expect(canUndo(s, wid, 'stu_a')).toBe(false); // 학생 버전엔 이력이 없다

    // 학생 버전에서 편집 후 취소 — 공통의 count=10 은 유지된다
    const aPid = s.doc.works[0].studentSets.stu_a.order[0];
    s = run(s, { type: 'updateProblem', workId: wid, problemId: aPid, patch: { count: 12 } });
    s = run(s, { type: 'undo', workId: wid, version: 'stu_a' });
    expect((s.doc.works[0].studentSets.stu_a.problems[aPid] as CountProblem).count).toBe(4);
    expect((s.doc.works[0].common.problems[commonPid] as CountProblem).count).toBe(10);
  });
});

describe('학생·버전 관리 (§10)', () => {
  test('버전 삭제는 학생 정보를 남긴다', () => {
    let s = setup();
    const wid = s.doc.works[0].id;
    const sA = { id: 'stu_a', displayName: '학생 A', iepGoal: '목표', supportNote: '' };
    s = run(s, { type: 'addStudent', workId: wid, student: sA });
    s = run(s, { type: 'createStudentVersion', workId: wid, studentId: 'stu_a' });
    expect(Object.keys(s.doc.works[0].studentSets)).toHaveLength(1);

    s = run(s, { type: 'deleteStudentVersion', workId: wid, studentId: 'stu_a' });
    expect(Object.keys(s.doc.works[0].studentSets)).toHaveLength(0);
    expect(s.doc.works[0].students).toHaveLength(1); // 학생 정보는 남음
    expect(s.doc.works[0].common.order).toHaveLength(0) // 공통 무변경
      ;
  });

  test('학생 정보 삭제는 버전과 참고 정보를 함께 지우고 공통은 남긴다', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    const wid = s.doc.works[0].id;
    const sA = { id: 'stu_a', displayName: '학생 A', iepGoal: '목표', supportNote: '' };
    s = run(s, { type: 'addStudent', workId: wid, student: sA });
    s = run(s, { type: 'createStudentVersion', workId: wid, studentId: 'stu_a' });

    s = run(s, { type: 'removeStudent', workId: wid, studentId: 'stu_a' });
    const w = s.doc.works[0];
    expect(w.students).toHaveLength(0);
    expect(w.studentSets.stu_a).toBeUndefined();
    expect(w.common.order).toHaveLength(1);
    expect(w.selectedVersion).toBe('common');
  });

  test('기존 검사기 학생은 표시 이름만 가져온다 (중복 방지)', () => {
    let s = setup();
    const wid = s.doc.works[0].id;
    s = run(s, { type: 'importLegacyStudents', workId: wid, students: [{ id: 'old1', name: '학생 가' }, { id: 'old2', name: '학생 나' }] });
    expect(s.doc.works[0].students.map((x) => x.displayName)).toEqual(['학생 가', '학생 나']);
    expect(s.doc.works[0].students.every((x) => x.linkedOldId?.startsWith('old'))).toBe(true);
    expect(s.doc.works[0].students.every((x) => x.iepGoal === '')).toBe(true); // 상태 번역 없음

    // 같은 학생을 두 번 가져오지 않는다
    const before = s.doc.works[0].students.length;
    s = run(s, { type: 'importLegacyStudents', workId: wid, students: [{ id: 'old1', name: '학생 가' }] });
    expect(s.doc.works[0].students.length).toBe(before);
  });
});

describe('불러오기·선택 (§12.4·§10.4)', () => {
  test('importWorks 는 항상 추가만 한다', () => {
    let s = setup();
    const imported = makeEmptyWork('불러온 작업');
    imported.id = s.doc.works[0].id; // 충돌
    s = run(s, { type: 'importWorks', works: [imported] });
    expect(s.doc.works).toHaveLength(2);
    expect(s.doc.works[1].name).toBe('불러온 작업');
  });

  test('버전 전환은 각 버전의 편집 내용을 보존한다', () => {
    let s = setup();
    s = run(s, { type: 'addProblem', workId: s.doc.works[0].id, kind: 'count' });
    const wid = s.doc.works[0].id;
    const sA = { id: 'stu_a', displayName: '학생 A', iepGoal: '', supportNote: '' };
    s = run(s, { type: 'addStudent', workId: wid, student: sA });
    s = run(s, { type: 'createStudentVersion', workId: wid, studentId: 'stu_a' });

    const aPid = s.doc.works[0].studentSets.stu_a.order[0];
    const cPid = s.doc.works[0].common.order[0];
    s = run(s, { type: 'setVersion', workId: wid, version: 'stu_a' });
    s = run(s, { type: 'updateProblem', workId: wid, problemId: aPid, patch: { count: 8 } });

    // 전환만으로 새 문제·복사본이 만들어지지 않는다
    const orderLen = s.doc.works[0].studentSets.stu_a.order.length;
    s = run(s, { type: 'setVersion', workId: wid, version: 'common' });
    expect(s.doc.works[0].common.order).toHaveLength(orderLen);
    expect(s.doc.works[0].selectedVersion).toBe('common');
    // 양쪽 내용 보존
    expect((s.doc.works[0].studentSets.stu_a.problems[aPid] as CountProblem).count).toBe(8);
    expect((s.doc.works[0].common.problems[cPid] as CountProblem).count).toBe(4);
  });
});

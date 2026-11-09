import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_MINUTES,
  SCENARIOS,
  createDb,
  editItem,
  expireActivities,
  isDb,
  runScenario,
  setItemStatus,
  startActivity,
  submitAttempt,
  summarize,
} from '../src/lib/store.js';

const T0 = 1_700_000_000_000;
const begin = (purpose = 'practice', studentId = 's1') =>
  startActivity(createDb(), { studentId, purpose, now: T0, id: 'act-1' });
const send = (db, itemId, selected, requestId, now = T0) =>
  submitAttempt(db, { activityId: 'act-1', itemId, selected, requestId, elapsedMs: 1200, now });

test('seed: 가상 학생 3명, 학생마다 목표 하나, 실명·장애 정보 없음', () => {
  const db = createDb();
  assert.ok(isDb(db));
  assert.equal(db.students.length, 3);
  assert.equal(db.goals.length, 3);
  for (const s of db.students) assert.deepEqual(Object.keys(s), ['id', 'alias', 'teacher']);
  assert.deepEqual(
    db.goals.map((g) => [g.min, g.max]),
    [
      [1, 5],
      [1, 10],
      [1, 20],
    ],
  );
});

test('승인된 문항만 배정하고, 평가 활동에는 지원 문항을 넣지 않는다', () => {
  const practice = begin('practice');
  assert.equal(practice.db.assignments.length, 5);
  const assess = begin('assess');
  assert.equal(assess.db.assignments.length, 3);
  assert.ok(assess.db.assignments.every((x) => x.snapshot.support === 'none'));
  const all = [...practice.db.assignments, ...assess.db.assignments].map((x) => x.itemId);
  assert.ok(!all.includes('g1-q6'), '초안 문항은 배정되지 않는다');
});

test('초안을 승인하면 다음 활동부터 배정된다', () => {
  const approved = setItemStatus(createDb(), 'g1-q6', 'approved').db;
  const r = startActivity(approved, { studentId: 's1', purpose: 'assess', now: T0, id: 'act-1' });
  assert.equal(r.db.assignments.length, 4);
});

test('같은 요청 식별키의 응답은 한 번만 저장한다', () => {
  const { db } = begin();
  const first = send(db, 'g1-q1', '나', 'tap-1');
  const again = send(first.db, 'g1-q1', '나', 'tap-1');
  assert.equal(first.duplicate, false);
  assert.equal(again.duplicate, true);
  assert.equal(again.db.attempts.length, 1);
  assert.equal(again.attempt.id, first.attempt.id);
});

test('재시도해도 첫 시도 정답률은 바뀌지 않는다', () => {
  let { db } = begin();
  db = send(db, 'g1-q1', '나', 'r1').db; // 가 4 · 나 2 → 오답
  db = send(db, 'g1-q1', '가', 'r2').db; // 재시도 정답
  db = send(db, 'g1-q2', '나', 'r3').db; // 가 3 · 나 5 → 첫 시도 정답
  const s = summarize(db, { activityId: 'act-1' });
  assert.equal(s.answered, 2);
  assert.equal(s.firstCorrect, 1);
  assert.equal(s.accuracy, 50);
  assert.equal(s.retries, 1);
  assert.deepEqual(s.wrongByCategory, { '차이 2 이상': 1 });
  assert.equal(db.attempts.find((a) => a.requestId === 'r2').attemptNo, 2);
});

test('이미 맞힌 문항에는 응답을 더 받지 않는다', () => {
  let { db } = begin();
  db = send(db, 'g1-q1', '가', 'r1').db;
  assert.equal(send(db, 'g1-q1', '가', 'r2').error, 'ALREADY_CORRECT');
});

test('지원이 들어간 정답과 지원 없는 정답을 나누어 센다', () => {
  let { db } = begin();
  db = send(db, 'g1-q1', '가', 'r1').db; // 지원 없음, 정답
  db = send(db, 'g1-q2', '가', 'r2').db; // 지원 없음, 오답
  db = send(db, 'g1-q4', '가', 'r3').db; // 일대일 대응 배열, 정답
  const s = summarize(db, { activityId: 'act-1' });
  assert.equal(s.bySupport.none.accuracy, 50);
  assert.equal(s.bySupport.align.accuracy, 100);
  assert.equal(s.accuracy, 67);
});

test('응답이 없으면 정답률은 0%가 아니라 없음이다', () => {
  const s = summarize(begin().db, { activityId: 'act-1' });
  assert.equal(s.accuracy, null);
  assert.equal(s.unanswered, 5);
});

test('문항을 고쳐도 배정된 기록은 풀이 당시 내용을 유지하고, 고친 문항은 초안이 된다', () => {
  let { db } = begin();
  db = send(db, 'g1-q1', '가', 'r1').db;
  const edited = editItem(db, 'g1-q1', { left: 1, right: 5 });
  assert.equal(edited.item.status, 'draft');
  assert.equal(edited.item.version, 2);
  const snapshot = edited.db.assignments.find((x) => x.itemId === 'g1-q1').snapshot;
  assert.deepEqual([snapshot.left, snapshot.right, snapshot.version], [4, 2, 1]);
  assert.equal(summarize(edited.db, { activityId: 'act-1' }).firstCorrect, 1);
  assert.equal(editItem(db, 'g1-q1', { left: 3, right: 3 }).error, 'BAD_VALUE');
  assert.equal(editItem(db, 'g1-q1', { left: 9, right: 1 }).error, 'BAD_VALUE');
});

test('모든 문항을 맞히면 활동이 완료된다', () => {
  let { db } = begin('assess');
  for (const x of db.assignments) db = send(db, x.itemId, x.snapshot.answer, `ok-${x.itemId}`).db;
  assert.equal(db.activities[0].status, 'done');
  assert.equal(send(db, 'g1-q1', '가', 'late').error, 'ACTIVITY_CLOSED');
});

test('기한이 지난 활동은 만료되고 이후 응답을 받지 않는다', () => {
  let { db } = begin();
  db = send(db, 'g1-q1', '가', 'r1').db;
  const later = T0 + ACTIVITY_MINUTES * 60 * 1000;
  assert.deepEqual(expireActivities(db, later - 1).expired, []);
  const late = send(db, 'g1-q2', '나', 'r2', later);
  assert.equal(late.error, 'ACTIVITY_CLOSED');
  assert.equal(late.db.activities[0].status, 'expired');
  assert.equal(late.db.attempts.length, 1);
});

test('진행 중인 활동이 있으면 새로 만들지 않고 이어서 한다', () => {
  const first = begin();
  const second = startActivity(first.db, {
    studentId: 's1',
    purpose: 'assess',
    now: T0 + 1000,
    id: 'act-2',
  });
  assert.equal(second.resumed, true);
  assert.equal(second.activity.id, 'act-1');
  assert.equal(second.db.activities.length, 1);
});

test('잘못된 요청은 저장하지 않는다', () => {
  const { db } = begin();
  assert.equal(send(db, 'g1-q6', '가', 'x1').error, 'NOT_ASSIGNED');
  assert.equal(send(db, 'g1-q1', '다', 'x2').error, 'BAD_CHOICE');
  assert.equal(
    submitAttempt(db, {
      activityId: 'none',
      itemId: 'g1-q1',
      selected: '가',
      requestId: 'x3',
      now: T0,
    }).error,
    'NO_ACTIVITY',
  );
});

test('화면에서 실행하는 네 가지 확인 항목이 모두 통과한다', () => {
  for (const { id } of SCENARIOS) {
    const result = runScenario(id);
    assert.equal(result.ok, true, `${id}: ${result.text}`);
  }
});

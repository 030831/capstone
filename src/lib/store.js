// 수량 비교 학습기록 저장 계층 (브라우저 저장소용 프로토타입)
//
// 서버가 맡을 일을 순수 함수로 먼저 만들어 둔 것이다. 모든 함수는 db를 고치지 않고 새 db를 돌려준다.
//   학생(students) · 학생별 목표(goals) · 문항(items) · 학습활동(activities) · 배정(assignments) · 응답(attempts)
//
// 서버 구현에서 확인하려는 네 가지 처리:
//   1) 같은 응답이 두 번 와도 한 번만 저장한다 (requestId)
//   2) 문항을 고쳐도 과거 기록은 풀이 당시 내용을 유지한다 (배정 시점 복사)
//   3) 승인된 문항만 학생에게 배정한다 (초안 / 승인 / 반려)
//   4) 기한이 지난 활동은 마감하고, 미응답은 오답으로 세지 않는다

export const ACTIVITY_MINUTES = 30;
export const ITEM_STATUS = { draft: '초안', approved: '승인', rejected: '반려' };
export const ACTIVITY_STATUS = { open: '진행', done: '완료', expired: '만료' };
export const SUPPORT_LABEL = { none: '지원 없음', align: '일대일 대응 배열' };
export const PURPOSE_LABEL = { practice: '연습', assess: '평가' };
export const CHOICES = ['가', '나'];

const answerOf = (left, right) => (left > right ? '가' : '나');
const categoryOf = (left, right) => (Math.abs(left - right) === 1 ? '차이 1' : '차이 2 이상');

// 가상 학생 3명과 학생별 목표. 실명 · 장애 정보는 두지 않는다.
const SEED_GOALS = [
  { n: 1, alias: '학생 ㄱ', min: 1, max: 5, presentation: 'picture', response: '그림을 보고 선택' },
  { n: 2, alias: '학생 ㄴ', min: 1, max: 10, presentation: 'picture', response: '가리켜서 응답' },
  { n: 3, alias: '학생 ㄷ', min: 1, max: 20, presentation: 'number', response: '숫자를 보고 선택' },
];
// [가, 나, 지원, 상태]
const SEED_ITEMS = {
  1: [
    [4, 2, 'none', 'approved'],
    [3, 5, 'none', 'approved'],
    [2, 3, 'none', 'approved'],
    [5, 3, 'align', 'approved'],
    [1, 4, 'align', 'approved'],
    [4, 5, 'none', 'draft'],
  ],
  2: [
    [7, 5, 'none', 'approved'],
    [6, 9, 'none', 'approved'],
    [8, 7, 'none', 'approved'],
    [10, 6, 'align', 'approved'],
    [4, 8, 'align', 'approved'],
    [9, 10, 'none', 'draft'],
  ],
  3: [
    [14, 11, 'none', 'approved'],
    [12, 18, 'none', 'approved'],
    [16, 17, 'none', 'approved'],
    [20, 15, 'align', 'approved'],
    [13, 19, 'align', 'approved'],
    [18, 17, 'none', 'draft'],
  ],
};

export function createDb() {
  const students = [];
  const goals = [];
  const items = [];
  for (const g of SEED_GOALS) {
    students.push({ id: `s${g.n}`, alias: g.alias, teacher: '가상 교사' });
    goals.push({
      id: `g${g.n}`,
      studentId: `s${g.n}`,
      standard: '수의 크기 비교',
      min: g.min,
      max: g.max,
      presentation: g.presentation,
      response: g.response,
      criterion: '가상 예시: 10문항 중 8문항',
    });
    SEED_ITEMS[g.n].forEach(([left, right, support, status], i) =>
      items.push({
        id: `g${g.n}-q${i + 1}`,
        goalId: `g${g.n}`,
        left,
        right,
        presentation: g.presentation,
        support,
        status,
        version: 1,
      }),
    );
  }
  return { version: 1, students, goals, items, activities: [], assignments: [], attempts: [] };
}

export function isDb(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    value.version === 1 &&
    ['students', 'goals', 'items', 'activities', 'assignments', 'attempts'].every((k) =>
      Array.isArray(value[k]),
    )
  );
}

// ---------- 문항: 초안 / 승인 / 반려 ----------
export function setItemStatus(db, itemId, status) {
  if (!ITEM_STATUS[status]) return { db, error: 'BAD_STATUS' };
  if (!db.items.some((i) => i.id === itemId)) return { db, error: 'NO_ITEM' };
  return { db: { ...db, items: db.items.map((i) => (i.id === itemId ? { ...i, status } : i)) } };
}

// 문항을 고치면 판이 올라가고 다시 초안이 된다. 이미 배정된 활동의 복사본은 건드리지 않는다.
export function editItem(db, itemId, { left, right }) {
  const item = db.items.find((i) => i.id === itemId);
  if (!item) return { db, error: 'NO_ITEM' };
  const goal = db.goals.find((g) => g.id === item.goalId);
  const ok = (n) => Number.isInteger(n) && n >= goal.min && n <= goal.max;
  if (!ok(left) || !ok(right) || left === right) return { db, error: 'BAD_VALUE' };
  const next = { ...item, left, right, version: item.version + 1, status: 'draft' };
  return { db: { ...db, items: db.items.map((i) => (i.id === itemId ? next : i)) }, item: next };
}

// ---------- 학습활동 ----------
export function expireActivities(db, now) {
  const expired = db.activities.filter((a) => a.status === 'open' && now >= a.expiresAt);
  if (!expired.length) return { db, expired: [] };
  const ids = new Set(expired.map((a) => a.id));
  return {
    db: {
      ...db,
      activities: db.activities.map((a) =>
        ids.has(a.id) ? { ...a, status: 'expired', closedAt: now } : a,
      ),
    },
    expired: [...ids],
  };
}

// 승인된 문항만 배정한다. 평가 활동에는 지원이 들어간 문항을 넣지 않는다.
export function startActivity(db, { studentId, purpose, now, id }) {
  if (!PURPOSE_LABEL[purpose]) return { db, error: 'BAD_PURPOSE' };
  const goal = db.goals.find((g) => g.studentId === studentId);
  if (!goal) return { db, error: 'NO_GOAL' };
  db = expireActivities(db, now).db;
  const open = db.activities.find((a) => a.studentId === studentId && a.status === 'open');
  if (open) return { db, activity: open, resumed: true };
  const items = db.items.filter(
    (i) =>
      i.goalId === goal.id &&
      i.status === 'approved' &&
      (purpose === 'practice' || i.support === 'none'),
  );
  if (!items.length) return { db, error: 'NO_APPROVED_ITEMS' };
  const activity = {
    id,
    studentId,
    goalId: goal.id,
    purpose,
    status: 'open',
    startedAt: now,
    expiresAt: now + ACTIVITY_MINUTES * 60 * 1000,
  };
  const assignments = items.map((item, order) => ({
    activityId: id,
    itemId: item.id,
    order,
    // 배정 시점의 문항 내용을 복사해 둔다. 이후 문항이 바뀌어도 이 기록은 그대로다.
    snapshot: {
      left: item.left,
      right: item.right,
      presentation: item.presentation,
      support: item.support,
      version: item.version,
      answer: answerOf(item.left, item.right),
      category: categoryOf(item.left, item.right),
    },
  }));
  return {
    db: {
      ...db,
      activities: [...db.activities, activity],
      assignments: [...db.assignments, ...assignments],
    },
    activity,
    resumed: false,
  };
}

// ---------- 응답 ----------
// 정답 여부는 보낸 쪽이 아니라 여기서, 배정 시점 복사본으로 판별한다.
export function submitAttempt(db, { activityId, itemId, selected, requestId, elapsedMs, now }) {
  const same = db.attempts.find((a) => a.requestId === requestId);
  if (same) return { db, attempt: same, duplicate: true };
  db = expireActivities(db, now).db;
  const activity = db.activities.find((a) => a.id === activityId);
  if (!activity) return { db, error: 'NO_ACTIVITY' };
  if (activity.status !== 'open') return { db, error: 'ACTIVITY_CLOSED' };
  const assignment = db.assignments.find((x) => x.activityId === activityId && x.itemId === itemId);
  if (!assignment) return { db, error: 'NOT_ASSIGNED' };
  if (!CHOICES.includes(selected)) return { db, error: 'BAD_CHOICE' };
  const before = db.attempts.filter((a) => a.activityId === activityId && a.itemId === itemId);
  if (before.some((a) => a.correct)) return { db, error: 'ALREADY_CORRECT' };
  const attempt = {
    id: `${activityId}:${itemId}:${before.length + 1}`, // (활동, 문항, 시도 번호)는 겹칠 수 없다
    activityId,
    itemId,
    attemptNo: before.length + 1,
    selected,
    correct: selected === assignment.snapshot.answer,
    elapsedMs: Math.max(0, Math.round(elapsedMs || 0)),
    requestId,
    submittedAt: now,
  };
  const attempts = [...db.attempts, attempt];
  const solved = new Set(
    attempts.filter((a) => a.activityId === activityId && a.correct).map((a) => a.itemId),
  );
  const done = db.assignments
    .filter((x) => x.activityId === activityId)
    .every((x) => solved.has(x.itemId));
  return {
    db: {
      ...db,
      attempts,
      activities: done
        ? db.activities.map((a) =>
            a.id === activityId ? { ...a, status: 'done', closedAt: now } : a,
          )
        : db.activities,
    },
    attempt,
    duplicate: false,
  };
}

// ---------- 기록으로 계산하는 값 ----------
const rate = (correct, answered) => (answered ? Math.round((correct / answered) * 100) : null);

export function summarize(db, { studentId, activityId } = {}) {
  const activities = db.activities.filter(
    (a) => (!studentId || a.studentId === studentId) && (!activityId || a.id === activityId),
  );
  const ids = new Set(activities.map((a) => a.id));
  const assignments = db.assignments.filter((x) => ids.has(x.activityId));
  const bySupport = {
    none: { assigned: 0, answered: 0, firstCorrect: 0 },
    align: { assigned: 0, answered: 0, firstCorrect: 0 },
  };
  const wrongByCategory = {};
  let answered = 0;
  let firstCorrect = 0;
  let retries = 0;
  for (const x of assignments) {
    const tries = db.attempts.filter((a) => a.activityId === x.activityId && a.itemId === x.itemId);
    const first = tries.find((a) => a.attemptNo === 1);
    const group = bySupport[x.snapshot.support];
    group.assigned += 1;
    retries += Math.max(0, tries.length - 1);
    if (!first) continue; // 미응답은 오답으로 세지 않는다
    answered += 1;
    group.answered += 1;
    if (first.correct) {
      firstCorrect += 1;
      group.firstCorrect += 1;
    } else {
      wrongByCategory[x.snapshot.category] = (wrongByCategory[x.snapshot.category] || 0) + 1;
    }
  }
  for (const g of Object.values(bySupport)) g.accuracy = rate(g.firstCorrect, g.answered);
  return {
    activities: activities.length,
    done: activities.filter((a) => a.status === 'done').length,
    expired: activities.filter((a) => a.status === 'expired').length,
    open: activities.filter((a) => a.status === 'open').length,
    assigned: assignments.length,
    answered,
    unanswered: assignments.length - answered,
    firstCorrect,
    accuracy: rate(firstCorrect, answered), // 첫 시도 정답 수 ÷ 첫 시도 응답 수
    retries,
    bySupport,
    wrongByCategory,
  };
}

// ---------- 네 가지 처리 확인 ----------
// 실제 기록을 건드리지 않도록 새 db에서 실행하고, 무엇이 일어났는지 숫자로 돌려준다.
export function runScenario(name) {
  const t0 = 1_700_000_000_000;
  let db = createDb();
  const start = (purpose = 'practice') => {
    const r = startActivity(db, { studentId: 's2', purpose, now: t0, id: 'check' });
    db = r.db;
    return r;
  };
  if (name === 'duplicate') {
    start();
    const req = { activityId: 'check', itemId: 'g2-q1', selected: '가', elapsedMs: 900, now: t0 };
    const a = submitAttempt(db, { ...req, requestId: 'tap-1' });
    const b = submitAttempt(a.db, { ...req, requestId: 'tap-1' });
    db = b.db;
    return {
      ok: !a.duplicate && b.duplicate && db.attempts.length === 1,
      sent: 2,
      saved: db.attempts.length,
      text: `같은 응답을 2번 보냄 → 저장된 응답 ${db.attempts.length}건, 두 번째는 기존 기록을 돌려줌`,
    };
  }
  if (name === 'snapshot') {
    start();
    db = submitAttempt(db, {
      activityId: 'check',
      itemId: 'g2-q1',
      selected: '가',
      requestId: 'tap-1',
      elapsedMs: 900,
      now: t0,
    }).db;
    const edited = editItem(db, 'g2-q1', { left: 3, right: 9 });
    db = edited.db;
    const kept = db.assignments.find((x) => x.itemId === 'g2-q1').snapshot;
    const still = summarize(db, { activityId: 'check' });
    return {
      ok: kept.left === 7 && kept.right === 5 && edited.item.left === 3 && still.firstCorrect === 1,
      text: `문항을 가 7 · 나 5에서 가 3 · 나 9로 수정 → 기록에는 풀이 당시의 가 ${kept.left} · 나 ${kept.right}와 정답 처리가 그대로 남음`,
    };
  }
  if (name === 'approval') {
    const drafts = db.items.filter((i) => i.goalId === 'g2' && i.status !== 'approved').length;
    start();
    const assigned = db.assignments.map((x) => x.itemId);
    const leaked = assigned.filter(
      (id) => db.items.find((i) => i.id === id).status !== 'approved',
    ).length;
    return {
      ok: drafts > 0 && leaked === 0,
      text: `초안 문항 ${drafts}개가 있는 상태에서 활동 시작 → 배정된 ${assigned.length}문항 모두 승인 문항, 초안은 ${leaked}개`,
    };
  }
  if (name === 'expiry') {
    start();
    const req = { activityId: 'check', elapsedMs: 900 };
    db = submitAttempt(db, { ...req, itemId: 'g2-q1', selected: '가', requestId: 'a', now: t0 }).db;
    db = submitAttempt(db, { ...req, itemId: 'g2-q2', selected: '가', requestId: 'b', now: t0 }).db;
    const later = t0 + (ACTIVITY_MINUTES + 1) * 60 * 1000;
    const late = submitAttempt(db, {
      ...req,
      itemId: 'g2-q3',
      selected: '가',
      requestId: 'c',
      now: later,
    });
    db = late.db;
    const s = summarize(db, { activityId: 'check' });
    return {
      ok:
        late.error === 'ACTIVITY_CLOSED' &&
        db.activities[0].status === 'expired' &&
        s.answered === 2 &&
        s.unanswered === 3 &&
        s.accuracy === 50,
      text: `5문항 중 2문항만 풀고 ${ACTIVITY_MINUTES}분 경과 → 활동은 만료, 이후 응답은 거부, 첫 시도 정답률은 응답한 2문항 기준 ${s.accuracy}% (미응답 ${s.unanswered}문항은 오답으로 세지 않음)`,
    };
  }
  return { ok: false, text: '알 수 없는 확인 항목' };
}

export const SCENARIOS = [
  {
    id: 'duplicate',
    title: '같은 응답이 두 번 저장됨',
    handle: '요청 식별키가 같으면 한 번만 저장',
  },
  {
    id: 'snapshot',
    title: '문항을 고치면 과거 기록의 의미가 바뀜',
    handle: '배정 시점의 문항을 기록에 복사',
  },
  {
    id: 'approval',
    title: '검토하지 않은 문항이 학생에게 노출됨',
    handle: '승인된 문항만 활동에 배정',
  },
  {
    id: 'expiry',
    title: '끝내지 않은 활동이 계속 진행 중으로 남음',
    handle: '기한이 지나면 마감, 미응답은 오답과 구분',
  },
];

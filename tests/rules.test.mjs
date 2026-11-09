import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewNotes, countNotes, RULES, SEVERITY } from '../src/design/rules.js';
import { DEFAULT_CONFIG, DEFAULT_GOAL } from '../src/design/model.js';

const goal = (o = {}) => ({ ...DEFAULT_GOAL, ...o });
const cfg = (o = {}) => ({ ...DEFAULT_CONFIG, ...o });
const ids = (notes) => notes.map((n) => n.id);

test('baseline (연습, 지원 없음, 범위 일치, 짧은 지시문) has no notes', () => {
  assert.deepEqual(reviewNotes(goal(), 'practice', cfg()), []);
});

test('R1 fires only for 평가 + 독립 수행 + 지원 있음', () => {
  assert.ok(ids(reviewNotes(goal(), 'assessment', cfg({ support: 'visual-cue' }))).includes('R1'));
  assert.ok(!ids(reviewNotes(goal(), 'practice', cfg({ support: 'visual-cue' }))).includes('R1'));
  assert.ok(
    !ids(
      reviewNotes(goal({ condition: 'assisted' }), 'assessment', cfg({ support: 'partial' })),
    ).includes('R1'),
  );
  assert.ok(!ids(reviewNotes(goal(), 'assessment', cfg({ support: 'none' }))).includes('R1'));
});

test('R2 fires for 산출 + 가리키기·선택 only', () => {
  assert.ok(
    ids(
      reviewNotes(goal({ behavior: 'produce' }), 'practice', cfg({ response: 'point' })),
    ).includes('R2'),
  );
  assert.ok(
    !ids(
      reviewNotes(goal({ behavior: 'produce' }), 'practice', cfg({ response: 'number' })),
    ).includes('R2'),
  );
  assert.ok(!ids(reviewNotes(goal(), 'practice', cfg({ response: 'point' }))).includes('R2'));
});

test('R3 fires when 수 범위 differs from 목표 내용 범위 and names both', () => {
  const [n] = reviewNotes(goal({ range: '1-5' }), 'practice', cfg({ range: '1-10' }));
  assert.equal(n.id, 'R3');
  assert.equal(n.severity, SEVERITY.CHECK);
  assert.match(n.text, /1–5/);
  assert.match(n.text, /1–10/);
  assert.ok(
    !ids(reviewNotes(goal({ range: '1-10' }), 'practice', cfg({ range: '1-10' }))).includes('R3'),
  );
});

test('R4 (참고) fires for 숫자만 + 판별, not for 산출', () => {
  const n = reviewNotes(goal(), 'practice', cfg({ presentation: 'numbers' })).find(
    (x) => x.id === 'R4',
  );
  assert.equal(n.severity, SEVERITY.INFO);
  assert.ok(
    !ids(
      reviewNotes(
        goal({ behavior: 'produce' }),
        'practice',
        cfg({ presentation: 'numbers', response: 'number' }),
      ),
    ).includes('R4'),
  );
});

test('R5 (참고) fires for 예시 문항 먼저 + 평가 only', () => {
  assert.ok(
    ids(
      reviewNotes(
        goal({ condition: 'assisted' }),
        'assessment',
        cfg({ support: 'worked-example' }),
      ),
    ).includes('R5'),
  );
  assert.ok(
    !ids(reviewNotes(goal(), 'practice', cfg({ support: 'worked-example' }))).includes('R5'),
  );
});

test('R6 is informational: word count when 지시문 길이=보통', () => {
  const n = reviewNotes(goal(), 'practice', cfg({ instruction: 'normal' })).find(
    (x) => x.id === 'R6',
  );
  assert.ok(n.informational);
  assert.equal(n.severity, SEVERITY.INFO);
  assert.match(n.text, /^지시문은 \d+어절입니다\.$/);
  assert.ok(!ids(reviewNotes(goal(), 'practice', cfg({ instruction: 'short' }))).includes('R6'));
});

test('changedFrom records the original value of the related axis', () => {
  const n = reviewNotes(goal(), 'practice', cfg({ range: '1-20' }), cfg()).find(
    (x) => x.id === 'R3',
  );
  assert.deepEqual(n.changedFrom, [{ key: 'range', from: '수 범위 1–5', to: '수 범위 1–20' }]);
});

test('no rule text claims a verdict', () => {
  const all = reviewNotes(
    goal({ behavior: 'produce' }),
    'assessment',
    cfg({ support: 'worked-example', response: 'point', range: '1-20', instruction: 'normal' }),
  );
  for (const n of all) assert.doesNotMatch(n.text, /틀렸|되돌려라|잘못|!/);
  assert.equal(RULES.length, 6);
});

test('countNotes moves acknowledged notes to 기록됨 and never counts R6 as a warning', () => {
  const notes = reviewNotes(
    goal(),
    'assessment',
    cfg({ support: 'visual-cue', range: '1-10', instruction: 'normal' }),
  );
  assert.deepEqual(countNotes(notes, {}, 'base'), { check: 2, info: 1, recorded: 0 });
  assert.deepEqual(countNotes(notes, { 'base:R1': '연습용' }, 'base'), {
    check: 1,
    info: 1,
    recorded: 1,
  });
});

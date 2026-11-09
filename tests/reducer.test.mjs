import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reducer,
  initialState,
  diffConfig,
  restore,
  notesFor,
  versionIds,
} from '../src/design/reducer.js';
import { examplesFor } from '../src/design/examples.js';

const run = (actions, s = initialState()) => actions.reduce(reducer, s);

test('cannot move past step 2 without choosing an example', () => {
  assert.equal(run([{ type: 'step', step: 3 }]).step, 1);
  const s = run([
    { type: 'chooseExample', id: 'pictures-point-cue' },
    { type: 'step', step: 3 },
  ]);
  assert.equal(s.step, 3);
});

test('choosing an example copies its config and takes the goal range', () => {
  const s = run([
    { type: 'goal', field: 'range', value: '1-10' },
    { type: 'chooseExample', id: 'pictures-numbers-symbol' },
  ]);
  assert.equal(s.base.range, '1-10');
  assert.equal(s.base.response, 'symbol');
});

test('a new variant starts identical to 공통 and diff lists only changed axes', () => {
  let s = run([
    { type: 'chooseExample', id: 'pictures-point-cue' },
    { type: 'createVariant', student: 'n' },
  ]);
  assert.deepEqual(diffConfig(s.base, s.variants.n.config), []);
  s = run(
    [
      { type: 'setVariant', student: 'n', field: 'response', value: 'symbol' },
      { type: 'setVariant', student: 'n', field: 'range', value: '1-10' },
      { type: 'setReason', student: 'n', field: 'response', text: '기호 연습' },
    ],
    s,
  );
  assert.deepEqual(diffConfig(s.base, s.variants.n.config), ['response', 'range']);
  assert.equal(s.variants.n.reasons.response, '기호 연습');
  // 공통 설정은 그대로
  assert.equal(s.base.response, 'point');
});

test('changing 공통 after creating a variant shows up as a diff (variants are independent copies)', () => {
  const s = run([
    { type: 'chooseExample', id: 'pictures-point-cue' },
    { type: 'createVariant', student: 'g' },
    { type: 'setBase', field: 'support', value: 'none' },
  ]);
  assert.deepEqual(diffConfig(s.base, s.variants.g.config), ['support']);
});

test('invalid values are ignored', () => {
  const s = run([
    { type: 'chooseExample', id: 'pictures-point-cue' },
    { type: 'setBase', field: 'support', value: 'magic' },
  ]);
  assert.equal(s.base.support, 'visual-cue');
});

test('variant review compares against 공통; R3 fires on the variant only', () => {
  const s = run([
    { type: 'chooseExample', id: 'pictures-numbers-symbol' },
    { type: 'createVariant', student: 'd' },
    { type: 'setVariant', student: 'd', field: 'range', value: '1-10' },
  ]);
  assert.deepEqual(versionIds(s), ['base', 'd']);
  assert.ok(!notesFor(s, 'base').some((n) => n.id === 'R3'));
  const r3 = notesFor(s, 'd').find((n) => n.id === 'R3');
  assert.equal(r3.changedFrom[0].from, '수 범위 1–5');
});

test('acknowledge / unacknowledge and remove variant', () => {
  let s = run([
    { type: 'chooseExample', id: 'pictures-point-cue' },
    { type: 'createVariant', student: 'g' },
    { type: 'acknowledge', key: 'g:R1', note: '연습용' },
    { type: 'activeVersion', id: 'g' },
  ]);
  assert.equal(s.acknowledged['g:R1'], '연습용');
  s = run(
    [
      { type: 'unacknowledge', key: 'g:R1' },
      { type: 'removeVariant', student: 'g' },
    ],
    s,
  );
  assert.equal(s.acknowledged['g:R1'], undefined);
  assert.equal(s.variants.g, undefined);
  assert.equal(s.activeVersion, 'base');
});

test('restore falls back to initial state on broken storage and keeps valid state', () => {
  assert.deepEqual(restore(null), initialState());
  assert.deepEqual(restore({ version: 1, goal: 'x' }), initialState());
  const s = run([
    { type: 'chooseExample', id: 'pictures-point-cue' },
    { type: 'step', step: 4 },
  ]);
  assert.deepEqual(restore(JSON.parse(JSON.stringify(s))), s);
  assert.equal(run([{ type: 'reset' }], s).base, null);
});

test('every goal combination offers 2–3 examples', () => {
  for (const behavior of ['discriminate', 'produce'])
    for (const range of ['1-5', '1-10', '1-20']) {
      const n = examplesFor({ behavior, condition: 'independent', criterion: '', range }).length;
      assert.ok(n >= 2 && n <= 3, `${behavior} ${range}: ${n}`);
    }
});

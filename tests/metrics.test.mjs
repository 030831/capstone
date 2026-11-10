import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../src/lib/metrics.js';
test('no responses are not interpreted as 0% ability', () =>
  assert.equal(summarize([]).accuracy, null));
test('retry success preserves initial error and access support is not a hint', () => {
  const value = summarize([
    {
      questions: [
        { firstCorrect: false, correct: true, attempts: 3, hints: 1 },
        { firstCorrect: true, correct: true, hints: 0, accessSupports: ['읽어주기'] },
        { firstCorrect: null, correct: false, hints: 0 },
      ],
    },
  ]);
  assert.deepEqual(value, {
    sessions: 1,
    answered: 2,
    firstCorrect: 1,
    withHint: 1,
    correct: 2,
    accuracy: 50,
  });
});
test('hints used on an unanswered item are still observed help use', () => {
  const s = summarize([{ questions: [{ firstCorrect: null, correct: false, hints: 2 }] }]);
  assert.equal(s.withHint, 1);
  assert.equal(s.answered, 0);
  assert.equal(s.accuracy, null);
});
